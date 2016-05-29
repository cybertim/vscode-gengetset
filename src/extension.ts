import {optimizeImports, analyzeWorkspace, IExport} from './import';
import {generateCode, generateClassesList, quickPickItemListFrom, EType} from './getset';
import * as vscode from 'vscode';

let cachedExports: IExport[];
function refreshExports() {
    analyzeWorkspace().then((exports) => {
        cachedExports = exports;
    });
}

export function activate(context: vscode.ExtensionContext) {

    // always keep a cached exports list updated in the background    
    refreshExports();
    vscode.workspace.onDidSaveTextDocument((event) => {
        refreshExports();
    });

    context.subscriptions.push(vscode.commands.registerCommand('genGetSet.getter', function () {
        const classesList = generateClassesList(EType.GETTER);
        vscode.window.showQuickPick(
            quickPickItemListFrom(classesList, EType.GETTER)).then((pickedItem) => {
                generateCode(classesList, EType.GETTER, pickedItem);
            });
    }));
    context.subscriptions.push(vscode.commands.registerCommand('genGetSet.setter', function () {
        const classesList = generateClassesList(EType.SETTER);
        vscode.window.showQuickPick(
            quickPickItemListFrom(classesList, EType.SETTER)).then((pickedItem) => {
                generateCode(classesList, EType.SETTER, pickedItem);
            });
    }));
    context.subscriptions.push(vscode.commands.registerCommand('genGetSet.getterAndSetter', function () {
        const classesList = generateClassesList(EType.BOTH);
        vscode.window.showQuickPick(
            quickPickItemListFrom(classesList, EType.BOTH)).then((pickedItem) => {
                generateCode(classesList, EType.BOTH, pickedItem);
            });
    }));
    context.subscriptions.push(vscode.commands.registerCommand('genGetSet.constructor', function () {
        const classesList = generateClassesList(EType.BOTH);
        generateCode(classesList, EType.CONSTRUCTOR);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('genGetSet.popup', function () {
        vscode.window.showQuickPick([
            <vscode.QuickPickItem>{
                label: 'Optimize Imports',
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
            if (result && result.label.indexOf('Optimize Imports') !== -1) {
                if (cachedExports === null || cachedExports === undefined)
                    vscode.window.showWarningMessage('Sorry, please wait a few seconds longer until the export cache has been build.');
                optimizeImports(cachedExports);
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
    }));
}

export function deactivate() { }