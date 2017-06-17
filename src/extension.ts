import { CompleteActionProvider } from './bulb';
import { DefinitionProvider } from './provider';
import { addSingleImport, optimizeImports } from './import';
import { generateClassesList, EType, quickPickItemListFrom, generateCode } from './getset';
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
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider(TYPESCRIPT, new CompleteActionProvider()));
    context.subscriptions.push(vscode.commands.registerCommand('genGetSet.addImport', function (item?: string) {
        if (readyCheck()) {
            if (!item) {
                vscode.window.showQuickPick(
                    DefinitionProvider.instance.toQuickPickItemList()).then((pickedItem) => {
                        if (!pickedItem) return;
                        addSingleImport(DefinitionProvider.instance.cachedExports, pickedItem.label);
                    });
            } else {
                addSingleImport(DefinitionProvider.instance.cachedExports, item);
            }
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('genGetSet.sortImports', function () {
        if (readyCheck()) {
            optimizeImports(DefinitionProvider.instance.cachedExports);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('genGetSet.scanImports', function () {
        if (readyCheck()) DefinitionProvider.instance.refreshExports();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('genGetSet.getter', function () {
        let classesList = generateClassesList(EType.GETTER);

        // Add ALL option
        let addAllClass: any = {name: 'any', vars: [{name: 'Add all', typeName:'Getters'}]};
        classesList.unshift(addAllClass);

        const extendedClassesList = classesList;
        const quickPickItemList: vscode.QuickPickItem[] = quickPickItemListFrom(extendedClassesList, EType.GETTER);
        vscode.window.showQuickPick(quickPickItemList).then((pickedItem) => {
            let auxPickedItemList: vscode.QuickPickItem[] = [];
            // Check if ALL option was selected
            if(pickedItem.label == 'Add all') 
                auxPickedItemList = quickPickItemList.splice(1,quickPickItemList.length-1);
            else 
                auxPickedItemList.push(pickedItem);    
            // Generate multiple getters and setter after remove added auxiliary ALL Option
            generateCode(extendedClassesList.splice(1,extendedClassesList.length-1), EType.GETTER, 
                auxPickedItemList);
        });
    }));
    context.subscriptions.push(vscode.commands.registerCommand('genGetSet.setter', function () {
        let classesList = generateClassesList(EType.SETTER);

        // Add ALL option
        let addAllClass: any = {name: 'any', vars: [{name: 'Add all', typeName:'Setters'}]};
        classesList.unshift(addAllClass);

        const extendedClassesList = classesList;
        const quickPickItemList: vscode.QuickPickItem[] = quickPickItemListFrom(extendedClassesList, EType.SETTER);
        vscode.window.showQuickPick(quickPickItemList).then((pickedItem) => {
            let auxPickedItemList: vscode.QuickPickItem[] = [];
            // Check if ALL option was selected
            if(pickedItem.label == 'Add all') 
                auxPickedItemList = quickPickItemList.splice(1,quickPickItemList.length-1);
            else 
                auxPickedItemList.push(pickedItem);    
            // Generate multiple getters and setter after remove added auxiliary ALL Option
            generateCode(extendedClassesList.splice(1,extendedClassesList.length-1), EType.SETTER, 
                auxPickedItemList);
        });
    }));
    context.subscriptions.push(vscode.commands.registerCommand('genGetSet.getterAndSetter', function () {
        let classesList = generateClassesList(EType.BOTH);

        // Add ALL option
        let addAllClass: any = {name: 'any', vars: [{name: 'Add all', typeName:'Getters and Setters'}]};
        classesList.unshift(addAllClass);

        const extendedClassesList = classesList;
        const quickPickItemList: vscode.QuickPickItem[] = quickPickItemListFrom(extendedClassesList, EType.BOTH);
        vscode.window.showQuickPick(quickPickItemList).then((pickedItem) => {
            let auxPickedItemList: vscode.QuickPickItem[] = [];
            // Check if ALL option was selected
            if(pickedItem.label == 'Add all') 
                auxPickedItemList = quickPickItemList.splice(1,quickPickItemList.length-1);
            else 
                auxPickedItemList.push(pickedItem);    
            // Generate multiple getters and setter after remove added auxiliary ALL Option
            generateCode(extendedClassesList.splice(1,extendedClassesList.length-1), EType.BOTH, 
                auxPickedItemList);
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
                label: 'Rescan Workspace',
                description: 'rescan all files in the workscape for exports'
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
            } else if (result && result.label.indexOf('Rescan Workspace') !== -1) {
                vscode.commands.executeCommand('genGetSet.scanImports');
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