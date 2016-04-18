'use strict';
import * as vscode from 'vscode';

enum EAction {
    GETTER, SETTER, BOTH, NONE
}

interface IFar {
    name: string;
    typeName: string;
}

interface IKlass {
    name: string;
    start: vscode.Position;
    end?: vscode.Position;
    items: IFar[];
    getters: string[];
    setters: string[];
}

export function activate(context: vscode.ExtensionContext) {

    var items: IKlass[];
    // regex to find the class name
    var regCName = /class\s([a-zA-Z]+)/;
    // regex to find private var names and types
    var regVName = /[\s]*private[\s]*([a-zA-Z_$][0-9a-zA-Z_$]*)[\s]?\:[\s]?([\.\<\>\{\}\[\]a-zA-Z_$]+)[\s\=|\;]/;
    // regex to find getter names
    var regGName = /public[\s]get[\s]([a-zA-Z_$][0-9a-zA-Z_$]*)[\(\)]+/;
    // regex to find setter names
    var regSName = /public[\s]set[\s]([a-zA-Z_$][0-9a-zA-Z_$]*)[\(]+[a-zA-Z_$][0-9a-zA-Z_$]*[\s\:]+/;

    function figure(name: string): string {
        if (name.startsWith('_')) return name.substring(1);
        return '$' + name;
    }

    function getConstructor(items: IFar[]): string {
        var c = '\n\tconstructor(';
        var b = false;
        for (let i = 0; i < items.length; i++) {
            if (b) c += ', '
            c += figure(items[i].name) + ': ' + items[i].typeName
            if (!b) b = true;
        }
        c += ') {';
        b = false;
        for (let i = 0; i < items.length; i++) {
            c += '\n\t\tthis.' + items[i].name + ' = ' + figure(items[i].name) + ';';
        }
        c += '\n\t}\n'
        return c;
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

    function processKlassByResult(result: vscode.QuickPickItem, action: EAction) {
        if (result && result.description) {
            var klass = getKlass(result.description);
            if (klass) {
                for (let i = 0; i < klass.items.length; i++) {
                    var item = klass.items[i];
                    if (item && result.label === item.name) {
                        vscode.window.activeTextEditor.edit((editBuiler) => {
                            // add template code blocks before the cursor position's line number
                            let pos = new vscode.Position(vscode.window.activeTextEditor.selection.active.line, 0);
                            if (action == EAction.GETTER || action == EAction.BOTH) editBuiler.insert(pos, getGetter(item));
                            if (action == EAction.SETTER || action == EAction.BOTH) editBuiler.insert(pos, getSetter(item));
                        });
                    }
                }
            }
        }
    }

    function scanForItems(action: EAction) {
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
                items.push({ name: className, start: new vscode.Position(i, 0), items: [], getters: [], setters: [] });
            }
            // within a class regex match for 'private' mentions
            // collect them and add them to the parent 'klass'
            let matches;
            let klass = getKlass(className);
            if (classStart) {
                matches = line.text.match(regVName);
                if (matches) {
                    if (klass) klass.items.push({ name: matches[1], typeName: matches[2] });
                }
                matches = line.text.match(regGName);
                if (matches) {
                    if (klass) klass.getters.push(matches[1]);
                }
                matches = line.text.match(regSName);
                if (matches) {
                    if (klass) klass.setters.push(matches[1]);
                }
                if (line.text.indexOf('{') != -1) bracketCount.open++;
                if (line.text.indexOf('}') != -1) bracketCount.closed++;
                if (bracketCount.closed != 0 && bracketCount.open != 0 && bracketCount.closed == bracketCount.open) {
                    classStart = false;
                    if (klass) {
                        klass.end = new vscode.Position(i, 0);
                        // it's scoped and cursor position is out of range
                        // remove items because we are not positioned within the class
                        if (pos.isBefore(klass.start) || pos.isAfter(klass.end)) {
                            var scoped = vscode.workspace.getConfiguration('genGetSet').get('scoped');
                            if (scoped) {
                                klass.items = [];
                            }
                        }
                        // if hide already added getters setters
                        // remove all already added get/set names
                        var filter = vscode.workspace.getConfiguration('genGetSet').get('filter');
                        if (filter) {
                            for (let i = klass.items.length - 1; i >= 0; i--) {
                                if (action == EAction.GETTER || action == EAction.BOTH) {
                                    for (let j = 0; j < klass.getters.length; j++) {
                                        if (figure(klass.items[i].name) == klass.getters[j]) {
                                            klass.items.splice(i, 1);
                                            break;
                                        }
                                    }
                                } else if (action == EAction.SETTER || action == EAction.BOTH) {
                                    for (let j = 0; j < klass.setters.length; j++) {
                                        if (figure(klass.items[i].name) === klass.setters[j]) {
                                            klass.items.splice(i, 1);
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

    }

    let subGetter = vscode.commands.registerCommand('genGetSet.getter', () => {
        scanForItems(EAction.GETTER);
        vscode.window.showQuickPick(klassToArray()).then((result) => {
            processKlassByResult(result, EAction.GETTER);
        });
    });

    let subSetter = vscode.commands.registerCommand('genGetSet.setter', () => {
        scanForItems(EAction.SETTER);
        vscode.window.showQuickPick(klassToArray()).then((result) => {
            processKlassByResult(result, EAction.SETTER);
        });
    });

    let subGetterAndSetter = vscode.commands.registerCommand('genGetSet.getterAndSetter', () => {
        scanForItems(EAction.BOTH);
        vscode.window.showQuickPick(klassToArray()).then((result) => {
            processKlassByResult(result, EAction.BOTH);
        });
    });

    let subConstructor = vscode.commands.registerCommand('genGetSet.constructor', () => {
        scanForItems(EAction.NONE);
        vscode.window.activeTextEditor.edit((editBuiler) => {
            let pos = new vscode.Position(vscode.window.activeTextEditor.selection.active.line, 0);
            for (let i = 0; i < items.length; i++) {
                if (pos.isAfterOrEqual(items[i].start) || pos.isBeforeOrEqual(items[i].end)) {
                    editBuiler.insert(pos, getConstructor(items[i].items));
                    return;
                }
            }
        });
    });

    let subPopup = vscode.commands.registerCommand('genGetSet.popup', () => {
        vscode.window.showQuickPick([
            <vscode.QuickPickItem>{
                label: 'Getter and Setter',
                description: 'both public get and set <name>'
            },
            <vscode.QuickPickItem>{
                label: 'Constructor',
                description: 'constructor(name)'
            },
            <vscode.QuickPickItem>{
                label: 'Getter',
                description: 'public get <name>'
            },
            <vscode.QuickPickItem>{
                label: 'Setter',
                description: 'public set <name>'
            }
        ]).then((result) => {
        });
    });

    context.subscriptions.push(subGetter);
    context.subscriptions.push(subSetter);
    context.subscriptions.push(subGetterAndSetter);
    context.subscriptions.push(subConstructor);
    context.subscriptions.push(subPopup);
}

export function deactivate() {
}