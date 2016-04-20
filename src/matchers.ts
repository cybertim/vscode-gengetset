
import * as vscode from 'vscode';

export interface IFar {
    name: string;
    figure: string;
    typeName: string;
}

export interface IKlass {
    name: string;
    start: vscode.Position;
    end?: vscode.Position;
    items: IFar[];
    getters: string[];
    setters: string[];
}

export interface IMatcher {
    klass: RegExp; // regex to match (1) name of class
    private_def: RegExp; // regex to match (1) private var name and (2) type of var (string, bool ..)
    get_method: RegExp; // regex to match (1) name of getter method
    set_method: RegExp; // regex to match (1) name of setter method
    expose_def: RegExp; // regex to match (1) exports / exposure of classes etc. to the public
    gen_getter: (item: IFar) => string; // function to generate code block for a getter function
    gen_setter: (item: IFar) => string; // function to generate code block for setter function
    gen_constructor: (items: IFar[]) => string; // function to generate constructor block
    figure: (fname: string) => string; // function to switch between private and public naming of far (ex. typescript: _name -> name)
}

export function createMatcher(language: string): IMatcher {
    switch (language.toLocaleLowerCase()) {
        case 'typescript':
            // these are the default for typescript
            return <IMatcher>{
                klass: /class\s([a-zA-Z]+)/,
                private_def: /[\s]*private[\s]*([a-zA-Z_$][0-9a-zA-Z_$]*)[\s]?\:[\s]?([\.\<\>\{\}\[\]a-zA-Z_$]+)[\s\=|\;]/,
                get_method: /public[\s]get[\s]([a-zA-Z_$][0-9a-zA-Z_$]*)[\(\)]+/,
                set_method: /public[\s]set[\s]([a-zA-Z_$][0-9a-zA-Z_$]*)[\(]+[a-zA-Z_$][0-9a-zA-Z_$]*[\s\:]+/,
                expose_def: /export[\s]+[\=]?[\s]?[a-zA-Z]*[\s]+([a-zA-Z_$][0-9a-zA-Z_$]*)[\(|\s|\;]/,
                gen_constructor: (items: IFar[]) => {
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
                },
                gen_getter: (item: IFar) => {
                    return '\n\tpublic get ' + item.figure + '(): ' + item.typeName + ' {\n' +
                        '\t\treturn this.' + item.name + ';\n' +
                        '\t}\n';
                },
                gen_setter: (item: IFar) => {
                    return '\n\tpublic set ' + item.figure + '(value: ' + item.typeName + ') {\n' +
                        '\t\tthis.' + item.name + ' = value;\n' +
                        '\t}\n';
                },
                figure: (fname: string) => {
                    if (fname.startsWith('_')) return fname.substring(1);
                    return '$' + fname;
                }
            }
        // add your own list of regex / building blocks for other languages
        default:
            return null;
    }
}
