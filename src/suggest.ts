import * as vscode from 'vscode'
import * as fs from 'fs'

interface IExpose {
    name: string;
    path: string;
    exported: string[];
}

export let modeId: string = 'typescript';

export class SuggestImport implements vscode.CompletionItemProvider {

    private exposeCache: IExpose[];
    private regex_all = /([a-zA-Z]+)[\[\:\)|\s|\(|\.|\;]+/g;
    private regex_one = /([a-zA-Z]+)[\[\:\)|\s|\(|\.|\;]+/;
    private regex_export = /export[\s]+[\=]?[\s]?[a-zA-Z]*[\s]+([a-zA-Z_$][0-9a-zA-Z_$]*)[\(|\s|\;]/;
    private regex_import_wildcard = /import[\s]+\*[\s]+as[\s]+[\S]*[\s]+from[\s]+[\'|\"]+([\S]*)[\'|\"]+[\;]?/;
    private regex_import = /import[\s]+[\{]*[\s]*[a-zA-Z\,\s]*[\s]*[\}]*[\s]*from[\s]*[\'\"]([\S]*)[\'|\"]+/;

    constructor() {
        this.exposeCache = [];
        this.reScan();
    }

    public reScan(): void {
        this.scanFiles().then((exposes) => {
            this.exposeCache = exposes;
        });
    }

    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.CompletionItem[] {
        //let start = new vscode.Position(position.line, 0);
        //let range = new vscode.Range(start, position);
        //let text = document.getText(range);
        return this.toItemArray();
    }

    public importAssist() {
        let languageId = vscode.window.activeTextEditor.document.languageId;
        if(languageId !== 'typescript') {
            vscode.window.showWarningMessage('Sorry, this extension does not support current language.');
            return;
        }
        vscode.window.activeTextEditor.edit((editBuilder) => {
            // first loop through all lines and replace them if needed
            let list = this.createList();
            let lineCount = vscode.window.activeTextEditor.document.lineCount;
            for (let i = 0; i < lineCount; i++) {
                let line = vscode.window.activeTextEditor.document.lineAt(i);
                let matcher = line.text.match(this.regex_import);
                // replace matched lines with new imports
                if (matcher) {
                    for (let j = list.length - 1; j >= 0; j--) {
                        if (matcher[1] === list[j].path + list[j].name) {
                            //this.replaceLine(list.splice(j, 1)[0], i);
                            let range = new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i + 1, 0));
                            editBuilder.replace(range, this.createLine(list.splice(j, 1)[0]));
                            break;
                        }
                    }
                }
                // check if it is a wildcard import and also remove the line from the list without doing anything
                matcher = line.text.match(this.regex_import_wildcard);
                if(matcher) {
                    for (let j = list.length - 1; j >= 0; j--) {
                        if (matcher[1] === list[j].path + list[j].name) {
                            list.splice(j, 1);
                        }
                    }
                }
            }
            // add rest of (new) import lines to the list
            for (let j = 0; j < list.length; j++) {
                let pos = new vscode.Position(0, 0);
                editBuilder.insert(pos, this.createLine(list[j]));
            }
        });
    }

    private createLine(expose: IExpose): string {
        let txt = 'import {';
        for (let i = 0; i < expose.exported.length; i++) {
            if (i != 0) txt += ', ';
            txt += expose.exported[i];
        }
        txt += '} from \'' + expose.path + expose.name + '\';\n'
        return txt;
    }

    private createList(): IExpose[] {
        let list: IExpose[] = [];
        let pos = vscode.window.activeTextEditor.selection.active;
        // grab all 'words' from the open text in the editor
        let matches: RegExpMatchArray = vscode.window.activeTextEditor.document.getText().toString().match(this.regex_all);
        let fname = vscode.window.activeTextEditor.document.fileName;
        let pcount = fname.split('/').length;
        let cname = fname.substring(fname.lastIndexOf('/') + 1, fname.length - 3);
        for (let i = 1; i < matches.length; i++) {
            // sub match the correct string, because javascript can't directly globally match groups... :( 
            let m = matches[i].match(this.regex_one);
            // do not try to match with common keywords (for speed)
            if (['from', 'return', 'get', 'set', 'boolean', 'string', 'if', 'var', 'let', 'for', 'public', 'class', 'new', 'import', 'as', 'private', 'while', 'case', 'switch', 'this'].indexOf(m[1]) == -1) {
                for (let j = 0; j < this.exposeCache.length; j++) {
                    // skip all exports from the open file where we are generating
                    if (this.exposeCache[j].name !== cname) {
                        if (this.exposeCache[j].exported.indexOf(m[1]) != -1) {
                            // search and add the found export to the list
                            // if a filename is already there, add the export to the exported list
                            let found = false;
                            for (let k = 0; k < list.length; k++) {
                                if (list[k].name === this.exposeCache[j].name) {
                                    if (list[k].exported.indexOf(m[1]) == -1) list[k].exported.push(m[1]);
                                    found = true;
                                    break;
                                }
                            }
                            if (!found) {
                                // also match paths with current file
                                // this is for a correct import listing (like ../ or ./)
                                var z = <IExpose>{
                                    name: this.exposeCache[j].name,
                                    path: this.createPath(this.exposeCache[j].path, pcount),
                                    exported: []
                                };
                                z.exported.push(m[1]);
                                list.push(z)
                            }
                        }
                    }
                }
            }
        }
        return list;
    }

    private createPath(path: string, pcount: number): string {
        var c = path.split('/').length;
        if (c == pcount) {
            return './';
        } else if (c < pcount) {
            let r = '';
            for (let m = c; m < pcount; m++) {
                r += '../'
            }
            return r;
        } else {
            let r = './';
            for (let m = pcount; m < c; m++) {
                r += path.split('/')[m - 1];
            }
            return r + '/';
        }
    }

    private scanFiles(): Thenable<IExpose[]> {
        return new Promise((resolve, reject) => {
            // scan all .ts files in the workspace and skip some common directories
            var excluded: string[] = ['/typings/'];
            vscode.workspace.findFiles('**/*.ts', '**/node_modules/**').then((files) => {
                var exposes: IExpose[] = [];
                for (let i = 0; i < files.length; i++) {
                    for (let j = 0; j < excluded.length; j++) {
                        if (files[i].fsPath.indexOf(excluded[j]) == -1) {
                            // create the IExpose based on filename and path
                            var expose = {
                                name: files[i].fsPath.substring(files[i].fsPath.lastIndexOf('/') + 1, files[i].fsPath.length - 3),
                                path: files[i].fsPath.substring(0, files[i].fsPath.lastIndexOf('/') + 1),
                                exported: []
                            };
                            var data = fs.readFileSync(files[i].fsPath);
                            var lines = data.toString().split(/(\r?\n)/g);
                            // walk through all lines of code and search for 'export' statements with the regex
                            for (let k = 0; k < lines.length; k++) {
                                var line = lines[k];
                                var matches = line.match(this.regex_export);
                                if (matches) {
                                    expose.exported.push(matches[1]);
                                }
                            }
                            exposes.push(expose);
                        }
                    }
                }
                resolve(exposes);
            }, (err) => {
                reject(err);
            });
        });
    }

    private toItemArray(): vscode.CompletionItem[] {
        var items: vscode.CompletionItem[] = [];
        for (let i = 0; i < this.exposeCache.length; i++) {
            for (let j = 0; j < this.exposeCache[i].exported.length; j++) {
                items.push(<vscode.CompletionItem>{
                    label: this.exposeCache[i].exported[j],
                    detail: this.exposeCache[i].path + this.exposeCache[i].name,
                    kind: vscode.CompletionItemKind.Reference,
                });
            }
        }
        return items;
    }

}

