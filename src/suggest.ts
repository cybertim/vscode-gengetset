import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'

interface IExpose {
    name: string;
    path?: string;
    exported: string[];
    dict: boolean;
    dict_name?: string;
}

interface ISub {
    name: string;
    start: number;
    end: number;
}

export let modeId: string = 'typescript';

export class SuggestImport implements vscode.CompletionItemProvider {

    private exclude_libs: string[] = ['node'];
    private commonList: string[] = ['from', 'return', 'get', 'set', 'boolean', 'string', 'if', 'var', 'let', 'for', 'public', 'class', 'new', 'import', 'as', 'private', 'while', 'case', 'switch', 'this'];
    private exposeCache: IExpose[];

    private regex_words = /([?_:\'\"a-zA-Z]{2,})/g;
    private regex_export = /export[\s]+[\s]?[\=]?[\s]?[a-zA-Z]*[\s]+[enum]*[\s]?([a-zA-Z_$][0-9a-zA-Z_$]*)[\:|\(|\s|\;]/;
    private regex_import = /import[\s]+[\*\{]*[\s]*[a-zA-Z\,\s]*[\s]*[\}]*[\s]*from[\s]*[\'\"]([\S]*)[\'|\"]+/;
    private regex_module = /declare[\s]+module[\s]+[\"|\']+([\S]*)[\"|\']+/;

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
        let provideCompletion = vscode.workspace.getConfiguration('genGetSet').get('provideCompletion');
        if (provideCompletion) return this.toItemArray();
        return [];
        //return this.toItemArray();
    }

    public importAssist() {
        let languageId = vscode.window.activeTextEditor.document.languageId;
        if (languageId !== 'typescript') {
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
                        if ((!list[j].dict && matcher[1] === this.sanitizePath(list[j].path, list[j].name)) ||
                            (list[j].dict && matcher[1] === list[j].name)) {
                            let range = new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i + 1, 0));
                            editBuilder.replace(range, this.createLine(list.splice(j, 1)[0]));
                            break;
                        }
                    }
                }
            }
            // add rest of (new) import lines to the list
            let wildcard = vscode.workspace.getConfiguration('genGetSet').get('importTypings');
            for (let j = 0; j < list.length; j++) {
                // don't parse excluded libs (like internal node)
                if (this.exclude_libs.indexOf(list[j].name) == -1) {
                    // only parse wildcard dict lines when the setting is enabled
                    if (!list[j].dict || (list[j].dict && wildcard)) {
                        let pos = new vscode.Position(0, 0);
                        editBuilder.insert(pos, this.createLine(list[j]));
                    }
                }
            }
        });
    }

    private createLine(expose: IExpose): string {
        let pathStringDelimiter = vscode.workspace.getConfiguration('genGetSet').get('pathStringDelimiter') || '\'';
        let txt = 'import ';
        if (!expose.dict) {
            // normal import from personal exports
            txt += '{';
            for (let i = 0; i < expose.exported.length; i++) {
                if (i != 0) txt += ', ';
                txt += expose.exported[i];
            }
            txt += '} from ';
            txt += pathStringDelimiter + this.sanitizePath(expose.path, expose.name) + pathStringDelimiter;
        } else {
            txt += '* as ' + expose.dict_name + ' from ';
            txt += pathStringDelimiter + expose.name + pathStringDelimiter;
        }
        txt += ';\n';
        return txt;
    }

    private sanitizePath(p: string, n: string): string {
        let prefix = '';
        if (!p.startsWith('.')) prefix = './';

        let pathComplete = path.join(p, n);
        if (vscode.workspace.getConfiguration('genGetSet').get('useSlashForImportPath')) {
            pathComplete = pathComplete.replace(/\\/g, '/');
        }
        return prefix + pathComplete;
    }

    private createList(): IExpose[] {
        let list: IExpose[] = [];
        let pos = vscode.window.activeTextEditor.selection.active;
        let fname = vscode.window.activeTextEditor.document.fileName;
        let cname = path.parse(fname).name;
        let lineCount = vscode.window.activeTextEditor.document.lineCount;
        // loop through all keywords within the document
        for (let i = 0; i < lineCount; i++) {
            if (vscode.window.activeTextEditor.document.lineAt(i).isEmptyOrWhitespace) continue;
            let line = vscode.window.activeTextEditor.document.lineAt(i).text.trim();
            // some fast common checks (whitespace, comment) cleanup
            if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;
            if (line.indexOf('//') !== -1) line = line.split('//')[0];
            // do not try to match with common keywords (for speed)
            let matches = line.match(this.regex_words);
            if (!matches) continue;
            for (let j = 0; j < matches.length; j++) {
                if (matches[j].indexOf('\'') == -1 && matches[j].indexOf('\"') == -1 && this.commonList.indexOf(matches[j]) == -1) {
                    for (let k = 0; k < this.exposeCache.length; k++) {
                        // do not process when the import is within the open file
                        if (this.exposeCache[k].name !== cname) {
                            // check if the keyword is in the exported list of the processItemResult
                            // or if it matches a dict typing name
                            if ((!this.exposeCache[k].dict && this.exposeCache[k].exported.indexOf(matches[j]) !== -1) ||
                                (this.exposeCache[k].dict && matches[j] === this.exposeCache[k].dict_name)) {
                                let found = false;
                                // search through the defined list if we already added an export for this keyword
                                // instead of directly add another import (to prevent doubles)
                                for (let l = 0; l < list.length; l++) {
                                    if (list[l].name === this.exposeCache[k].name) {
                                        if (list[l].exported.indexOf(matches[j]) == -1) list[l].exported.push(matches[j]);
                                        found = true;
                                        break;
                                    }
                                }
                                // expose wasn't in the list yet - create a new entry and push the new keyword into the list
                                if (!found) {
                                    let dir = path.parse(vscode.window.activeTextEditor.document.fileName).dir;
                                    list.push(
                                        <IExpose>{
                                            name: this.exposeCache[k].name,
                                            path: this.exposeCache[k].dict ? null : path.relative(dir, this.exposeCache[k].path),
                                            exported: [matches[j]],
                                            dict: this.exposeCache[k].dict,
                                            dict_name: this.exposeCache[k].dict_name
                                        });
                                }
                            }
                        }
                    }
                }
            }
        }
        return list;
    }

    private scanFiles(): Thenable<IExpose[]> {
        return new Promise((resolve, reject) => {
            // scan all .ts files in the workspace and skip some common directories
            //var excluded: string[] = ['/typings/'];
            vscode.workspace.findFiles('**/*.ts', '').then((files) => {
                var exposes: IExpose[] = [];
                for (let i = 0; i < files.length; i++) {
                    let parsedPath = path.parse(files[i].fsPath)
                    let data = fs.readFileSync(files[i].fsPath);
                    let lines = data.toString().split(/(\r?\n)/g);
                    let dict = files[i].fsPath.endsWith('.d.ts');
                    if (!dict) {
                        // parse a normal file use the filename when imported
                        var expose: IExpose = {
                            name: parsedPath.name,
                            path: parsedPath.dir,
                            exported: [],
                            dict: dict
                        };
                        // walk through all lines of code and search for 'export' statements with the regex
                        for (let k = 0; k < lines.length; k++) {
                            let line = lines[k];
                            let matches = line.match(this.regex_export);
                            if (matches) {
                                expose.exported.push(matches[1]);
                            }
                        }
                        exposes.push(expose);
                    } else {
                        // parse a "d.ts" file search for module declarations"
                        let sub: ISub;
                        for (let k = 0; k < lines.length; k++) {
                            let line = lines[k];
                            let mmatches = line.match(this.regex_module);
                            if (mmatches) {
                                if (sub) {
                                    sub.end = k;
                                    let asname = this.asName(sub.name);
                                    if (!this.contains(exposes, asname)) exposes.push(this.subMatchModule(sub.name, asname, sub.start, sub.end, lines));
                                }
                                sub = { name: mmatches[1].toString(), start: k, end: lines.length };
                            }
                        }
                        // only add a dict entry if it is non-existing in the list
                        // there are most of the time multiple 'd.ts' files in the filesystem because of npm/typings
                        if (sub) {
                            let asname = this.asName(sub.name);
                            if (!this.contains(exposes, asname)) exposes.push(this.subMatchModule(sub.name, asname, sub.start, sub.end, lines));
                        }
                    }
                }
                resolve(exposes);
            }, (err) => {
                reject(err);
            });
        });
    }

    private contains(list: IExpose[], asname: string): boolean {
        for (let i = 0; i < list.length; i++) {
            if (list[i].dict_name === asname) return true;
        }
        return false;
    }

    // create the 'as' name for the import based on the dashes used by npm
    // instead of a dash make one upperase letter like 'body-parser' becomes 'bodyParser'
    private asName(name: string): string {
        let asname = '';
        for (let i = 0; i < name.length; i++) {
            if (name.charAt(i) == '-') {
                i++;
                asname += name.charAt(i).toUpperCase();
            } else {
                asname += name.charAt(i).toLowerCase();
            }
        }
        return asname;
    }

    private subMatchModule(name: string, asname: string, start: number, end: number, lines: string[]): IExpose {
        var expose: IExpose = {
            name: name,
            exported: [],
            dict: true,
            dict_name: asname
        };
        for (let k = start; k < end; k++) {
            let line = lines[k];
            let matches = line.match(this.regex_export);
            if (matches) {
                let n = asname + '.' + matches[1];
                if (expose.exported.indexOf(n) == -1) expose.exported.push(n);
            }
        }
        return expose;
    }

    private toItemArray(): vscode.CompletionItem[] {
        var items: vscode.CompletionItem[] = [];
        for (let i = 0; i < this.exposeCache.length; i++) {
            for (let j = 0; j < this.exposeCache[i].exported.length; j++) {
                items.push(<vscode.CompletionItem>{
                    label: this.exposeCache[i].exported[j],
                    detail: this.exposeCache[i].path ? this.exposeCache[i].path.substring(vscode.workspace.rootPath.length) + this.exposeCache[i].name : this.exposeCache[i].dict_name,
                    kind: vscode.CompletionItemKind.Reference,
                });
            }
        }
        return items;
    }

}

