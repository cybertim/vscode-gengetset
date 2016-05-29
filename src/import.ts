import * as path from 'path';
import * as vscode from 'vscode';
import * as fs from 'fs';

enum EType {
    NODE, TYPING, LOCAL
}

export interface IExport {
    libraryName: string;
    path?: string;
    exported?: string[];
    type: EType;
    asName?: string;
}

// a quick list of keywords we probably want to skip asap.
const commonKeywordList: string[] = ['from', 'null', 'return', 'get', 'set', 'boolean', 'string', 'if', 'var', 'let', 'const', 'for', 'public', 'class', 'interface', 'new', 'import', 'as', 'private', 'while', 'case', 'switch', 'this', 'function', 'enum'];
// paths to ignore while looking through node_modules 
const commonIgnorePaths: string[] = ['esm', 'testing', 'test', 'facade', 'backends'];
// all regexp matchers we use to analyze typescript documents
const matchers = {
    commonWords: /([.?_:\'\"a-zA-Z0-9]{2,})/g,
    exports: /export[\s]+[\s]?[\=]?[\s]?(function|class|interface|var|let|const|enum|[\s]+)*([a-zA-Z_$][0-9a-zA-Z_$]*)[\:|\(|\s|\;\<]/,
    imports: /import[\s]+[\*\{]*[\s]*[a-zA-Z\,\s]*[\s]*[\}]*[\s]*from[\s]*[\'\"]([\S]*)[\'|\"]+/,
    node: /export[\s]+declare[\s]+[a-zA-Z]+[\s]+([a-zA-Z_$][0-9a-zA-Z_$]*)[\:]?[\s]?/,
    typings: /declare[\s]+module[\s]+[\"|\']+([\S]*)[\"|\']+/
}

export function optimizeImports(exports: IExport[]) {
    const filteredExports = filterExports(exports);
    vscode.window.activeTextEditor.edit((builder) => {
        const lineCount = vscode.window.activeTextEditor.document.lineCount;
        // search for import-lines we can replace instead of adding another bunch of the same lines
        for (let i = 0; i < lineCount; i++) {
            const line = vscode.window.activeTextEditor.document.lineAt(i);
            const matches = line.text.match(matchers.imports);
            if (matches) {
                let _export = containsLibraryName(filteredExports, matches[1]) || containsSanitizedPath(filteredExports, matches[1]);
                if (_export !== null) {
                    const range = new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i + 1, 0));
                    builder.replace(range, createImportLine(_export));
                    // remove this element from the list
                    filteredExports.splice(filteredExports.indexOf(_export), 1); 
                }
            }
        }
        // all filtered exportes left are added as new imports
        for (let i = 0; i < filteredExports.length; i++) {
            builder.replace(new vscode.Position(0, 0), createImportLine(filteredExports[i]));
        }
    });
}

// filter (ex. all exports found in the workspace) againt the active/open file in the editor
// create a list of imports needed based on words found in the open file
function filterExports(exports: IExport[]): IExport[] {
    let filteredExports: IExport[] = [];
    const currentDir = path.parse(vscode.window.activeTextEditor.document.fileName).dir;
    const file = {
        currentPos: vscode.window.activeTextEditor.selection.active,
        fileName: vscode.window.activeTextEditor.document.fileName,
        libraryName: path.parse(vscode.window.activeTextEditor.document.fileName).name,
        lineCount: vscode.window.activeTextEditor.document.lineCount
    }
    for (let i = 0; i < file.lineCount; i++) {
        // quick filters to skip lines fast without analyzing
        if (vscode.window.activeTextEditor.document.lineAt(i).isEmptyOrWhitespace) continue;
        let line = vscode.window.activeTextEditor.document.lineAt(i).text.trim();
        if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;
        if (line.indexOf('//') !== -1) line = line.split('//')[0];
        const matches = line.match(matchers.commonWords);
        if (!matches) continue;
        // walk through each found common word on this line
        for (let j = 0; j < matches.length; j++) {
            // only process unquoted words which are not listed in the commonList
            if (matches[j].indexOf('\'') === -1 &&
                matches[j].indexOf('\"') === -1 &&
                commonKeywordList.indexOf(matches[j]) === -1) {
                // split method calls based on the dot, no need to sub-minimatch
                // we use intellisens for that :)
                const splitted = matches[j].split('.');
                const _word: string = splitted.length > 0 ? splitted[0] : matches[j];
                // now search the exports for this word
                for (let k = 0; k < exports.length; k++) {
                    // do not process exported items from this same file
                    if (exports[k].libraryName === file.libraryName) continue;
                    if ((exports[k].type === EType.LOCAL && exports[k].exported.indexOf(_word) !== -1) ||
                        (exports[k].type === EType.TYPING && _word === exports[k].asName) ||
                        (exports[k].type === EType.NODE && exports[k].exported.indexOf(_word) !== -1)) {
                        // check if the import was already added and this is an extra import from
                        // the same library (add it to exported) else add a new import to the list
                        let _export = containsLibraryName(filteredExports, exports[k].libraryName);
                        if (_export === null) {
                            _export = {
                                libraryName: exports[k].libraryName,
                                type: exports[k].type,
                                path: path.relative(currentDir, exports[k].path),
                                asName: exports[k].asName,
                                exported: []
                            }
                            filteredExports.push(_export);
                        }
                        // typing is a wildcard import, no need to add submodules
                        if (_export.type !== EType.TYPING) {
                            if (_export.exported.indexOf(_word) === -1) _export.exported.push(_word);
                        }
                    }
                }
            }
        }
    }
    return filteredExports;
}

// analyze all typescript (.ts) files within the workspace including
// node_modules and typings, this is promised and runs in he background
export function analyzeWorkspace(): Promise<IExport[]> {
    return new Promise((resolve, reject) => {
        const includeNode = vscode.workspace.getConfiguration('genGetSet').get('importNode');
        const includeTypings = vscode.workspace.getConfiguration('genGetSet').get('importTypings');
        vscode.workspace.findFiles('**/*.ts', '').then((files) => {
            let exports: IExport[] = [];
            for (let i = 0; i < files.length; i++) {
                // globally analyze the found .ts file and load all data for
                // a line to line analyzes
                const file = {
                    path: path.parse(files[i].fsPath),
                    lines: fs.readFileSync(files[i].fsPath).toString().split(/(\r?\n)/g),
                    dts: files[i].fsPath.endsWith('.d.ts')
                }
                // analyze files based on their EType
                if (file.dts &&
                    file.path.dir.indexOf('typings' + path.sep) !== -1 &&
                    includeTypings) {
                    // Process d.ts files from the Typings directory
                    // they describe pure javascript node_modules with a 'module' tag
                    for (let k = 0; k < file.lines.length; k++) {
                        const line = file.lines[k];
                        const matches = line.match(matchers.typings);
                        if (matches) {
                            const asName = createAsName(matches[1].toString());
                            // don't add doubles (can happen) this is not yet supported
                            // TODO: make the system understand doubles (popup menu selection?)
                            if (containsAsName(exports, asName) === null) {
                                let _export: IExport = {
                                    libraryName: matches[1].toString(),
                                    path: file.path.dir,
                                    type: EType.TYPING,
                                    asName: asName
                                }
                                exports.push(_export);
                            }
                        }
                    }
                } else if (file.dts &&
                    file.path.dir.indexOf('node_modules' + path.sep) !== -1 &&
                    includeNode) {
                    // skip common directories where we do not need to look
                    let validPath = true;
                    for (let z = 0; z < commonIgnorePaths.length; z++) {
                        if (file.path.dir.indexOf(path.sep + commonIgnorePaths[z]) !== -1) validPath = false;
                    }
                    // Process node_modules like Angular2 etc.
                    // these libraries contain their own d.ts files with 'export declares'
                    if (validPath) {
                        let _export: IExport = {
                            libraryName: constructNodeLibraryName(file.path),
                            path: file.path.dir,
                            type: EType.NODE,
                            exported: []
                        }
                        for (let k = 0; k < file.lines.length; k++) {
                            const line = file.lines[k];
                            const matches = line.match(matchers.node);
                            if (matches) {
                                _export.exported.push(matches[1]);
                            }
                        }
                        exports.push(_export);
                    }
                } else if (!file.dts &&
                    file.path.dir.indexOf('node_modules/') === -1 &&
                    file.path.dir.indexOf('typings/') === -1) {
                    // Process local .ts files
                    // these are your own source files who import by path
                    let _export: IExport = {
                        libraryName: file.path.name,
                        path: file.path.dir,
                        type: EType.LOCAL,
                        exported: []
                    }
                    for (let k = 0; k < file.lines.length; k++) {
                        const line = file.lines[k];
                        const matches = line.match(matchers.exports);
                        if (matches) {
                            _export.exported.push(matches[2]);
                        }
                    }
                    exports.push(_export);
                }
            }
            resolve(exports);
        }, (err) => {
            reject(err);
        });
    });
}

// instead of a very-deep-analyzing of all d.ts files within the node_module dir:
// a thoughtfull 'hack' to go down a path in the module
// when we hit a index.d.ts we know this is (probably) the import 'libraryName'
// ...this can't be true for all cases, but for ionic and angular it's ok for now :)
function constructNodeLibraryName(_path: path.ParsedPath): string {
    const tree = _path.dir.split(path.sep);
    const node = tree.indexOf('node_modules') + 1;
    for (let i = tree.length; i >= node; i--) {
        let constructedPath = '/';
        for (let j = 0; j < i; j++) {
            constructedPath = constructedPath + tree[j] + '/';
        }
        let files = fs.readdirSync(constructedPath);
        if (files.indexOf('index.d.ts') !== -1) {
            let returnPath = '';
            for (let j = node; j < i; j++) {
                returnPath = returnPath + (returnPath === '' ? '' : '/') + tree[j];
            }
            return returnPath;
        }
    }
    return null;
}

// build the import line based on the given IExport
// there is a custom setting for using ' or "
function createImportLine(_export: IExport): string {
    let pathStringDelimiter = vscode.workspace.getConfiguration('genGetSet').get('pathStringDelimiter') || '\'';
    let txt = 'import ';
    if (_export.type === EType.LOCAL ||
        _export.type === EType.NODE) {
        txt += '{';
        for (let i = 0; i < _export.exported.length; i++) {
            if (i != 0) txt += ', ';
            txt += _export.exported[i];
        }
        txt += '} from ';
        if (_export.type === EType.LOCAL)
            txt += pathStringDelimiter + sanitizePath(_export.path, _export.libraryName) + pathStringDelimiter;
        if (_export.type === EType.NODE)
            txt += pathStringDelimiter + _export.libraryName + pathStringDelimiter;
    } else if (_export.type === EType.TYPING) {
        txt += '* as ' + _export.asName + ' from ';
        txt += pathStringDelimiter + _export.libraryName + pathStringDelimiter;
    }
    txt += ';\n';
    return txt;
}

// based on the location of the open file create a relative path
// to the imported file
function sanitizePath(p: string, n: string): string {
    const prefix = !p.startsWith('.') ? '.' + path.sep : '';
    let pathComplete = prefix + path.join(p, n);
    // on windows* change the slashes to '/' for cross-platform compatibility
    if (path.sep === '\\') {
        pathComplete = pathComplete.replace(/\\/g, '/');
    }
    return pathComplete;
}

function createAsName(name: string): string {
    let asname = '';
    for (let i = 0; i < name.length; i++) {
        if (name.charAt(i) == '-') {
            i++;
            asname += name.charAt(i).toUpperCase();
        } else {
            asname += name.charAt(i).toLowerCase();
        }
    }
    return asname;
}

// A bunch of functions used to easily search through the IExport[] lists
// can probably be optimized for speed ;)

function containsAsName(exports: IExport[], asName: string): IExport {
    for (let i = 0; i < exports.length; i++) {
        if (exports[i].asName === asName) return exports[i];
    }
    return null;
}

function containsLibraryName(exports: IExport[], libraryName: string): IExport {
    for (let i = 0; i < exports.length; i++) {
        if (exports[i].libraryName === libraryName) return exports[i];
    }
    return null;
}

function containsSanitizedPath(exports: IExport[], _path: string): IExport {
    for (let i = 0; i < exports.length; i++) {
        if (sanitizePath(exports[i].path, exports[i].libraryName) === _path) return exports[i];
    }
    return null;
}
