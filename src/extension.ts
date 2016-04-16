'use strict';
import * as vscode from 'vscode';

interface IFar {
    name: string;
    typeName: string;
}

interface IKlass {
    name: string;
    start: vscode.Position;
    end?: vscode.Position;
    items: IFar[];
}

export function activate(context: vscode.ExtensionContext) {

    var items: IKlass[];
    var regCName = /class\s([a-zA-Z]+)/;
    var regVName = /[\s]*private[\s]*([a-zA-Z_$][0-9a-zA-Z_$]*)[\s]?\:[\s]?([\.\<\>\{\}\[\]a-zA-Z_$]+)[\s\=|\;]/;

    function figure(name: string): string {
        if (name.startsWith('_')) return name.substring(1);
        return '$' + name;
    }

    function getGetter(item: IFar): string {
        return '\n\tpublic get ' + figure(item.name) + '(): ' + item.typeName + ' {\n' +
            '\t\treturn this.' + item.name + ';\n' +
            '\t}\n';
    }

    function getSetter(item: IFar): string {
        return '\n\tpublic set ' + figure(item.name) + '(value: ' + item.typeName + ') {\n' +
            '\t\tthis.' + item.name + ' = value;\n' +
            '\t}\n';
    }

    function getKlass(name: string): IKlass {
        for (let i = 0; i < items.length; i++) {
            if (items[i].name === name) {
                return items[i];
            }
        }
        return null;
    }

    function klassToArray(): vscode.QuickPickItem[] {
        var s: vscode.QuickPickItem[] = [];
        for (let i = 0; i < items.length; i++) {
            for (let j = 0; j < items[i].items.length; j++) {
                s.push(<vscode.QuickPickItem>{
                    label: items[i].items[j].name,
                    description: items[i].name,
                    detail: items[i].items[j].typeName
                });
            }
        }
        return s;
    }

    function processKlassByResult(result: vscode.QuickPickItem, getter?: boolean, setter?: boolean) {
        if (result && result.description) {
            var klass = getKlass(result.description);
            if (klass) {
                for (let i = 0; i < klass.items.length; i++) {
                    var item = klass.items[i];
                    if (item && result.label === item.name) {
                        vscode.window.activeTextEditor.edit((editBuiler) => {
                            // add template code blocks before the cursor position's line number
                            let pos = new vscode.Position(vscode.window.activeTextEditor.selection.active.line, 0);
                            if (getter) editBuiler.insert(pos, getGetter(item));
                            if (setter) editBuiler.insert(pos, getSetter(item));
                        });
                    }
                }
            }
        }
    }

    function scanForItems() {
        items = [];
        let pos = vscode.window.activeTextEditor.selection.active;
        let lineCount = vscode.window.activeTextEditor.document.lineCount;
        let classStart = false;
        let className: string;
        let bracketCount = { open: 0, closed: 0 };
        // search each line of the active editor for an index of 'class'
        // when found start counting brackets, when they match up and aren't 0
        // we looped through a class
        for (let i = 0; i < lineCount; i++) {
            let line = vscode.window.activeTextEditor.document.lineAt(i);
            if (!classStart && line.text.indexOf('class') != -1) {
                let matches = line.text.match(regCName);
                if (matches) className = matches[1];
                classStart = true;
                bracketCount.open = 0;
                bracketCount.closed = 0;
                items.push({ name: className, start: new vscode.Position(i, 0), items: [] });
            }
            // within a class regex match for 'private' mentions
            // collect them and add them to the parent 'klass'
            if (classStart) {
                let matches = line.text.match(regVName);
                if (matches) {
                    var klass = getKlass(className);
                    if (klass) {
                        klass.items.push({ name: matches[1], typeName: matches[2] });
                    }
                }
                if (line.text.indexOf('{') != -1) bracketCount.open++;
                if (line.text.indexOf('}') != -1) bracketCount.closed++;
                if (bracketCount.closed != 0 && bracketCount.open != 0 && bracketCount.closed == bracketCount.open) {
                    classStart = false;
                    var klass = getKlass(className);
                    if (klass) {
                        klass.end = new vscode.Position(i, 0);
                        if (pos.isBefore(klass.start) || pos.isAfter(klass.end)) {
                            var scoped = vscode.workspace.getConfiguration('genGetSet').get('scoped');
                            if (scoped) {
                                // it's scoped and cursor position is out of range
                                // remove items because we are not positioned within the class
                                klass.items = [];
                            }
                        }
                    }
                }
            }
        }

    }

    let subGetter = vscode.commands.registerCommand('genGetSet.getter', () => {
        scanForItems();
        vscode.window.showQuickPick(klassToArray()).then((result) => {
            processKlassByResult(result, true, false);
        });
    });

    let subSetter = vscode.commands.registerCommand('genGetSet.setter', () => {
        scanForItems();
        vscode.window.showQuickPick(klassToArray()).then((result) => {
            processKlassByResult(result, false, true);
        });
    });

    let subGetterAndSetter = vscode.commands.registerCommand('genGetSet.getterAndSetter', () => {
        scanForItems();
        vscode.window.showQuickPick(klassToArray()).then((result) => {
            processKlassByResult(result, true, true);
        });
    });

    context.subscriptions.push(subGetter);
    context.subscriptions.push(subSetter);
    context.subscriptions.push(subGetterAndSetter);
}

// this method is called when your extension is deactivated
export function deactivate() {
}