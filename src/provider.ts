import {IExport, analyzeWorkspace} from './import';
import * as vscode from 'vscode';

export class ExportsDefinitionProvider implements vscode.CompletionItemProvider {

    private static _instance: ExportsDefinitionProvider = new ExportsDefinitionProvider();
    private _cachedExports: IExport[];
    private _statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

    constructor() {
        if (ExportsDefinitionProvider._instance)
            throw new Error("Error: Instantiation failed: Use .instance instead of new.");
        this._statusBarItem.command = 'genGetSet.popup';
        this._statusBarItem.show();
        this.refreshExports();
        vscode.workspace.onDidSaveTextDocument((event) => {
            this.refreshExports();
        });
        ExportsDefinitionProvider._instance = this;
    }

    public static get instance(): ExportsDefinitionProvider {
        return ExportsDefinitionProvider._instance;
    }

    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.CompletionItem[]> {
        return new Promise((resolve, reject) => {
            console.log('making list...');
            if (this._cachedExports === null || this._cachedExports === undefined) resolve(null);
            let items: vscode.CompletionItem[] = [];
            for (let i = 0; i < this._cachedExports.length; i++) {
                if (this._cachedExports[i].exported) {
                    for (let j = 0; j < this._cachedExports[i].exported.length; j++) {
                        items.push(new vscode.CompletionItem(this._cachedExports[i].exported.length[j]));
                    }
                }
            }
            console.log(items.length);
            resolve(items);
        });
    }

    private refreshExports() {
        this._statusBarItem.text = '$(eye) $(sync)';
        analyzeWorkspace().then((exports) => {
            this._cachedExports = exports;
            this._statusBarItem.text = '$(eye) ' + exports.length;
        });
    }

    public get cachedExports(): IExport[] {
        return this._cachedExports;
    }

}