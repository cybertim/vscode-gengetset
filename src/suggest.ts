import * as vscode from 'vscode';
import * as fs from 'fs'

interface IExpose {
    name: string;
    path: string;
    exported: string[];
}

export let modeId: string = 'typescript';

// export class FormatImport implements vscode.DocumentFormattingEditProvider {
//     public provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.TextEdit[] {
//         var edits: vscode.TextEdit[] = [];
//         console.log('we are FORMATTING..');
//         return edits;
//     }
// }

//
// TODO refresh list when saving/editting a document
//
export class SuggestImport implements vscode.CompletionItemProvider {

    private exposeCache: IExpose[];
    private regex_export = /export[\s]+[\=]?[\s]?[a-zA-Z]*[\s]+([a-zA-Z_$][0-9a-zA-Z_$]*)[\(|\s|\;]/;
    private regex_import = /import[\s]+[\*|\{][\s]*[as]*[\s]*[\S]*[\s]*[\}]*[\s]*from[\s]+[\"]([\S]*)[\"][\;]/;


    constructor() {
        this.exposeCache = [];
        this.scanFiles().then((exposes) => {
            this.exposeCache = exposes;
        });
    }

    private scanFiles(): Thenable<IExpose[]> {
        return new Promise((resolve, reject) => {
            var excluded: string[] = ['/typings/'];
            vscode.workspace.findFiles('**/*.ts', '**/node_modules/**').then((files) => {
                var exposes: IExpose[] = [];
                for (let i = 0; i < files.length; i++) {
                    for (let j = 0; j < excluded.length; j++) {
                        if (files[i].fsPath.indexOf(excluded[j]) == -1) {
                            var expose = {
                                name: files[i].fsPath.substring(files[i].fsPath.lastIndexOf('/') + 1, files[i].fsPath.length - 3),
                                path: files[i].fsPath.substring(0, files[i].fsPath.lastIndexOf('/') + 1),
                                exported: []
                            };
                            var data = fs.readFileSync(files[i].fsPath);
                            var lines = data.toString().split(/(\r?\n)/g);
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

    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.CompletionItem[] {
        let start = new vscode.Position(position.line, 0);
        let range = new vscode.Range(start, position);
        let text = document.getText(range);
        return this.toItemArray();
    }
}

