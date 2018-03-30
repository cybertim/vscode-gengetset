import * as vscode from 'vscode';

export enum EType {
    GETTER, SETTER, BOTH, CONSTRUCTOR
}

interface IVar {
    name: string;
    figure: string;
    typeName: string;
}

interface IClass {
    name: string;
    startPos: vscode.Position;
    endPos?: vscode.Position;
    vars: IVar[];
    getters: string[];
    setters: string[];
}

const matchers = {
    className: /class\s([a-zA-Z]+)/,
    privateDef: /[\s]*private[\s]*([a-zA-Z_$][0-9a-zA-Z_$]*)[\s]?\:[\s]?([\.\<\>\{\}\[\]a-zA-Z_$\s<>,]+)[\=|\;]/,
    getMethod: /public[\s]get[\s]?([a-zA-Z_$][0-9a-zA-Z_$]*)[\(\)]+/,
    setMethod: /public[\s]set[\s]?([a-zA-Z_$][0-9a-zA-Z_$]*)[\(]+[a-zA-Z_$][0-9a-zA-Z_$]*[\s\:]+/
}

// generate code lines into the current active window based on EType
export function generateCode(classes: IClass[], type: EType, pickedItem?: vscode.QuickPickItem) {
    const currentPos = new vscode.Position(vscode.window.activeTextEditor.selection.active.line, 0);
    if (type !== EType.CONSTRUCTOR && pickedItem) {
        const _class = getClass(classes, pickedItem.description);
        if (_class) {
            for (let i = 0; i < _class.vars.length; i++) {
                var item = _class.vars[i];
                if (item && pickedItem.label === item.name) {
                    vscode.window.activeTextEditor.edit((builder) => {
                        // add template code blocks before the cursor position's line number
                        if (type == EType.GETTER || type == EType.BOTH)
                            builder.insert(currentPos, createGetter(item));
                        if (type == EType.SETTER || type == EType.BOTH)
                            builder.insert(currentPos, createSetter(item));
                    });
                }
            }
        }
    } else if (type === EType.CONSTRUCTOR) {
        vscode.window.activeTextEditor.edit((builder) => {
            for (let i = 0; i < classes.length; i++) {
                if (currentPos.isAfterOrEqual(classes[i].startPos) || currentPos.isBeforeOrEqual(classes[i].endPos)) {
                    builder.insert(currentPos, createConstructor(classes[i].vars));
                    return;
                }
            }
        });
    }
}

// generate multiple line, can't call vscode.window.activeTextEditor.edit(builder => {}) serveral time by command, don't know why
export function generateAllGetterAndSetter(classesListGetter, classesListSetter) {

    const currentPos = new vscode.Position(vscode.window.activeTextEditor.selection.active.line, 0);

    let totalString = '';

    classesListGetter[0].vars.forEach(variable => {
        totalString += createGetter(variable);
    });

    classesListSetter[0].vars.forEach(variable => {
        totalString += createSetter(variable);
    });

    vscode.window.activeTextEditor.edit((builder) => {
        builder.insert(currentPos, totalString);
    });
}

// generate a list of pickable items based on EType
export function quickPickItemListFrom(classes: IClass[], type: EType): vscode.QuickPickItem[] {
    let quickPickItemList: vscode.QuickPickItem[] = [];
    for (let i = 0; i < classes.length; i++) {
        for (let j = 0; j < classes[i].vars.length; j++) {
            quickPickItemList.push(<vscode.QuickPickItem>{
                label: classes[i].vars[j].name,
                description: classes[i].name,
                detail: classes[i].vars[j].typeName
            });
        }
    }
    return quickPickItemList;
}

// scan the current active text window and construct an IClass array
export function generateClassesList(type: EType): IClass[] {
    let classes: IClass[] = [];
    let brackets = {
        name: null,
        within: false,
        open: 0,
        closed: 0
    };
    const currentPos = vscode.window.activeTextEditor.selection.active;
    const lineCount = vscode.window.activeTextEditor.document.lineCount;
    // these are settings which can be adjusted for personal taste
    const scoped = vscode.workspace.getConfiguration('genGetSet').get('scoped');
    const filter = vscode.workspace.getConfiguration('genGetSet').get('filter');
    for (let i = 0; i < lineCount; i++) {
        const line = vscode.window.activeTextEditor.document.lineAt(i);
        // check if we are outside a class (brackets) and a new class definition pops-up
        // when it does we are now within a class def and we can start checking for private variables
        if (!brackets.within && line.text.indexOf('class') != -1) {
            brackets.within = true;
            let matches = line.text.match(matchers.className);
            if (matches) brackets.name = matches[1];
            brackets.open = 0;
            brackets.closed = 0;
            classes.push({
                name: brackets.name,
                startPos: new vscode.Position(i, 0),
                vars: [],
                getters: [],
                setters: []
            });
        }
        // within brackets start matching each line for a private variable
        // and add them to the corresponding IClass
        if (brackets.within) {
            let _class = getClass(classes, brackets.name);
            const matches = {
                privateDef: line.text.match(matchers.privateDef),
                getMethod: line.text.match(matchers.getMethod),
                setMethod: line.text.match(matchers.setMethod)
            };
            if (_class &&
                (matches.getMethod || matches.privateDef || matches.setMethod)) {
                // push the found items into the approriate containers
                if (matches.privateDef) {
                    _class.vars.push({
                        name: matches.privateDef[1],
                        figure: publicName(matches.privateDef[1]),
                        typeName: matches.privateDef[2]
                    });
                }
                if (matches.getMethod) _class.getters.push(matches.getMethod[1]);
                if (matches.setMethod) _class.setters.push(matches.setMethod[1]);
            }
            if (line.text.indexOf('{') != -1) brackets.open++;
            if (line.text.indexOf('}') != -1) brackets.closed++;
            // if the brackets match up we are (maybe) leaving a class definition
            if (brackets.closed != 0 && brackets.open != 0 && brackets.closed == brackets.open) {
                brackets.within = false;
                // no maybe - we were actually within a class
                // check scoped setting: remove all found items if they are not 
                // found within the class where the cursor is positioned
                if (_class) {
                    _class.endPos = new vscode.Position(i, 0);
                    if (scoped &&
                        (currentPos.isBefore(_class.startPos) || currentPos.isAfter(_class.endPos))) {
                        _class.vars = [];
                    }
                    // if filter is enabled: there is also no need to show already added 
                    // getters and setters methods in the list
                    if (filter) {
                        for (let i = _class.vars.length - 1; i >= 0; i--) {
                            if (type == EType.GETTER || type == EType.BOTH) {
                                for (let j = 0; j < _class.getters.length; j++) {
                                    console.log(_class.vars[i].figure, _class.getters[j]);
                                    if (_class.vars[i].figure.toLowerCase() == _class.getters[j].toLowerCase()) {
                                        _class.vars.splice(i, 1);
                                        break;
                                    }
                                }
                            } else if (type == EType.SETTER || type == EType.BOTH) {
                                for (let j = 0; j < _class.setters.length; j++) {
                                    if (_class.vars[i].figure.toLowerCase() === _class.setters[j].toLowerCase()) {
                                        _class.vars.splice(i, 1);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
                // done analyzing a class, up to the next
            }
        }
    }
    return classes;
}

// convert the private name to a public name
// based on the 'classic' setting, see README.md
function publicName(fname: string) {
    const classic = vscode.workspace.getConfiguration('genGetSet').get('classic');
    if (classic) return fname;
    if (fname.startsWith('_')) return fname.substring(1);
    return '$' + fname;
}

function createGetter(item: IVar) {
    const classic = vscode.workspace.getConfiguration('genGetSet').get('classic');
    if (classic) {
        return '\n    /**\n     * Getter ' + item.figure + '\n     * @return {' + item.typeName + '}\n     */\n\tpublic get' + item.name.charAt(0).toUpperCase() + item.name.substring(1) + '(): ' + item.typeName + ' {\n' +
            '\t\treturn this.' + item.name + ';\n' +
            '\t}\n';
    } else {
        return '\n    /**\n     * Getter ' + item.figure + '\n     * @return {' + item.typeName + '}\n     */\n\tpublic get ' + item.figure + '(): ' + item.typeName + ' {\n' +
            '\t\treturn this.' + item.name + ';\n' +
            '\t}\n';
    }
}

function createSetter(item: IVar) {
    const classic = vscode.workspace.getConfiguration('genGetSet').get('classic');
    if (classic) {
        return '\n    /**\n     * Setter ' + item.figure + '\n     * @param {' + item.typeName + '} value\n     */\n\tpublic set' + item.name.charAt(0).toUpperCase() + item.name.substring(1) + '(value: ' + item.typeName + ') {\n' +
            '\t\tthis.' + item.name + ' = value;\n' +
            '\t}\n';
    } else {
        return '\n    /**\n     * Setter ' + item.figure + '\n     * @param {' + item.typeName + '} value\n     */\n\tpublic set ' + item.figure + '(value: ' + item.typeName + ') {\n' +
            '\t\tthis.' + item.name + ' = value;\n' +
            '\t}\n';
    }
}

function createConstructor(items: IVar[]) {
    var c = '\n\tconstructor(';
    var b = false;
    for (let i = 0; i < items.length; i++) {
        if (b) c += ', '
        c += items[i].figure + ': ' + items[i].typeName
        if (!b) b = true;
    }
    c += ') {';
    b = false;
    for (let i = 0; i < items.length; i++) {
        c += '\n\t\tthis.' + items[i].name + ' = ' + items[i].figure + ';';
    }
    c += '\n\t}\n'
    return c;
}

function getClass(items: IClass[], name: string): IClass {
    for (let i = 0; i < items.length; i++) {
        if (items[i].name === name) {
            return items[i];
        }
    }
    return null;
}
