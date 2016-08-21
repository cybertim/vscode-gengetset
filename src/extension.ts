import {DefinitionProvider} from './provider';
import {optimizeImports, analyzeWorkspace, IExport} from './import';
import {generateCode, generateClassesList, quickPickItemListFrom, EType} from './getset';
import * as vscode from 'vscode';

const TYPESCRIPT: vscode.DocumentFilter = { language: 'typescript' }

function readyCheck() {
    if (vscode.window.activeTextEditor === undefined) {
        vscode.window.showWarningMessage(
            'Need an active TypeScript document opened in the editor to function.');
        return false;
    }
    if (DefinitionProvider.instance.cachedExports === null ||
        DefinitionProvider.instance.cachedExports === undefined) {
        vscode.window.showWarningMessage(
            'Please wait a few seconds longer until the export cache has been build.',
            'Refresh').then((r) => {
                DefinitionProvider.instance.refreshExports();
            });
        return false;
    }
    return true;
}

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('genGetSet.addImport', function () {
        if (readyCheck()) {
            vscode.window.showQuickPick(
                DefinitionProvider.instance.toQuickPickItemList()).then((pickedItem) => {
                    if (!pickedItem) return;
                    optimizeImports(DefinitionProvider.instance.cachedExports, pickedItem.label);
                });
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('genGetSet.sortImports', function () {
        if (readyCheck()) {
            optimizeImports(DefinitionProvider.instance.cachedExports);
        }
    }));
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
                label: 'Add Import',
                description: 'add and search through available imports'
            },
            <vscode.QuickPickItem>{
                label: 'Optimize Imports',
                description: 'sort and import missing libraries'
            },
            <vscode.QuickPickItem>{
                label: 'Constructor',
                description: 'generate a constructor based on privates'
            },
            <vscode.QuickPickItem>{
                label: 'Getter and Setter',
                description: 'generate a getter and setter public function'
            },
            <vscode.QuickPickItem>{
                label: 'Getter',
                description: 'generate a getter public function'
            },
            <vscode.QuickPickItem>{
                label: 'Setter',
                description: 'generate a setter public function'
            }
        ]).then((result) => {
            if (result && result.label.indexOf('Add Import') !== -1) {
                vscode.commands.executeCommand('genGetSet.addImport');
            } else if (result && result.label.indexOf('Optimize Imports') !== -1) {
                vscode.commands.executeCommand('genGetSet.sortImports');
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