import {IExport, analyzeWorkspace, ExportType} from './import';
import * as vscode from 'vscode';

export class DefinitionProvider {

    private static _instance: DefinitionProvider = new DefinitionProvider();
    private _cachedExports: IExport[];
    private _statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    private _refreshing: boolean = false;
    private _refreshingPromise: Promise<void> = undefined;

    constructor() {
        if (DefinitionProvider._instance)
            throw new Error("Error: Instantiation failed: Use .instance instead of new.");
        this._statusBarItem.command = 'genGetSet.popup';
        this._statusBarItem.show();
        this.refreshExports();

        const scanOnSave = vscode.workspace.getConfiguration('genGetSet').get('scanOnSave');
        if (scanOnSave) {
            vscode.workspace.onDidSaveTextDocument((event) => {
                this.refreshExports();
            });
        }

        DefinitionProvider._instance = this;
    }

    public static get instance(): DefinitionProvider {
        return DefinitionProvider._instance;
    }

    public refreshExports() {
        if (!this._refreshing) {
            this._refreshing = true;
            this._statusBarItem.text = '$(eye) $(sync)';
            
            this._refreshingPromise = new Promise<void>((resolve, reject) => {
              
                analyzeWorkspace().then((exports) => {
                    this._refreshing = false;
                    this._cachedExports = exports;

                    resolve();
                    this._refreshingPromise = undefined;

                    this._statusBarItem.text = '$(eye) ' + exports.length;
                }, (err) => {                    
                    this._refreshing = false;
                    this._statusBarItem.text = '';

                    resolve(); // Never reject. 
                    this._refreshingPromise = undefined;
                });
              
            });    
        }
    }

    public get cachedExports(): IExport[] {
        return this._cachedExports;
    }

    public getCachedExportsAsync(): Promise<IExport[]> {
        if (!this._refreshingPromise)
            return Promise.resolve(this._cachedExports);
        else {
            return new Promise<IExport[]>((resolve, reject) => {
                this._refreshingPromise.then(() => {
                    resolve(this._cachedExports);
                });
            });
        }
    }

    
    // public containsItem(name: string): boolean {
    //     for (let i = 0; i < this._cachedExports.length; i++) {
    //         if (this._cachedExports[i].libraryName) {
    //             if (this._cachedExports[i].exported) {
    //                 for (let j = 0; j < this._cachedExports[i].exported.length; j++) {
    //                     if (this._cachedExports[i].exported[j] === name) return true;
    //                 }
    //             } else {
    //                 if (this._cachedExports[i].asName === name) return true;
    //             }
    //         }
    //     }
    //     return false;
    // }

    public toQuickPickItemList(): Thenable<vscode.QuickPickItem[]> {
        return new Promise((resolve, reject) => {
            let quickPickItemList: vscode.QuickPickItem[] = [];
            for (let i = 0; i < this._cachedExports.length; i++) {
                if (this._cachedExports[i].libraryName) {
                    if (this._cachedExports[i].exported) {
                        for (let j = 0; j < this._cachedExports[i].exported.length; j++) {
                            quickPickItemList.push(<vscode.QuickPickItem>{
                                label: this._cachedExports[i].exported[j],
                                description: this._cachedExports[i].libraryName
                            });
                        }
                    } else {
                        quickPickItemList.push(<vscode.QuickPickItem>{
                            label: this._cachedExports[i].asName,
                            description: this._cachedExports[i].libraryName
                        });
                    }
                }
            }
            resolve(quickPickItemList);
        });
    }

}