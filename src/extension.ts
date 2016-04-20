'use strict';
import * as vscode from 'vscode';
import * as analyze from './analyze'
import * as suggest from './suggest'

enum EAction {
    GETTER, SETTER, BOTH, NONE
}

export function activate(context: vscode.ExtensionContext) {

    let suggestImport = new suggest.SuggestImport();
    vscode.languages.registerCompletionItemProvider(suggest.modeId, suggestImport);

    // update intellisense typings (re-scan) when a document is saved
    vscode.workspace.onDidSaveTextDocument((event) => {
        suggestImport.reScan();
    });

    let subImport = vscode.commands.registerCommand('genGetSet.import', () => {
        suggestImport.importAssist();
    });
    context.subscriptions.push(subImport);

    let subGetter = vscode.commands.registerCommand('genGetSet.getter', () => {
        var items = analyze.scanFile(analyze.EAction.GETTER);
        vscode.window.showQuickPick(analyze.toItemList(items)).then((result) => {
            analyze.processItemResult(items, result, EAction.GETTER);
        });
    });
    context.subscriptions.push(subGetter);

    let subSetter = vscode.commands.registerCommand('genGetSet.setter', () => {
        var items = analyze.scanFile(analyze.EAction.SETTER);
        vscode.window.showQuickPick(analyze.toItemList(items)).then((result) => {
            analyze.processItemResult(items, result, EAction.SETTER);
        });
    });
    context.subscriptions.push(subSetter);

    let subGetterAndSetter = vscode.commands.registerCommand('genGetSet.getterAndSetter', () => {
        var items = analyze.scanFile(analyze.EAction.BOTH);
        vscode.window.showQuickPick(analyze.toItemList(items)).then((result) => {
            analyze.processItemResult(items, result, EAction.BOTH);
        });
    });
    context.subscriptions.push(subGetterAndSetter);

    let subConstructor = vscode.commands.registerCommand('genGetSet.constructor', () => {
        var items = analyze.scanFile(analyze.EAction.NONE);
        analyze.processItemsConstructor(items);
    });
    context.subscriptions.push(subConstructor);

    let subPopup = vscode.commands.registerCommand('genGetSet.popup', () => {
        vscode.window.showQuickPick([
            <vscode.QuickPickItem>{
                label: 'Import Assistant',
                description: 'import {...} from'
            },
            <vscode.QuickPickItem>{
                label: 'Constructor',
                description: 'public constructor(...)'
            },
            <vscode.QuickPickItem>{
                label: 'Getter and Setter',
                description: 'both public get and set <name> (...)'
            },
            <vscode.QuickPickItem>{
                label: 'Getter',
                description: 'public get <name>'
            },
            <vscode.QuickPickItem>{
                label: 'Setter',
                description: 'public set <name> (...)'
            }
        ]).then((result) => {
            if (result && result.label.indexOf('Import Assistant') !== -1) {
                suggestImport.importAssist();
            } else if (result && result.label.indexOf('Getter and Setter') !== -1) {
                vscode.commands.executeCommand('genGetSet.getterAndSetter');
            } else if (result && result.label.indexOf('Getter') !== -1) {
                vscode.commands.executeCommand('genGetSet.getter');
            } else if (result && result.label.indexOf('Setter') !== -1) {
                vscode.commands.executeCommand('genGetSet.setter');
            } else if (result) {
                vscode.commands.executeCommand('genGetSet.constructor');
            }
        });
    });
    context.subscriptions.push(subPopup);
}

export function deactivate() {
}