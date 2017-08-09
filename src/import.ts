import * as path from 'path';
import * as vscode from 'vscode';
import * as fs from 'fs';

export enum ExportType {
    NODE, TYPING, LOCAL
}

export interface IExport {
    libraryName: string;
    path?: string;
    exported?: string[];
    type: ExportType;
    asName?: string;
}

export function exportListContainsItem(exportList: IExport[], name: string): boolean {
    if (!exportList)
        return false;

    for (let i = 0; i < exportList.length; i++) {
        if (exportList[i].libraryName) {
            if (exportList[i].exported) {
                for (let j = 0; j < exportList[i].exported.length; j++) {
                    if (exportList[i].exported[j] === name)
                        return true;
                }
            } else {
                if (exportList[i].asName === name)
                    return true;
            }
        }
    }
    return false;
}

//
// the 'magic numbers' which make this extension possible :-)
//
// a quick list of keywords we probably want to skip asap.
const commonKeywordList: string[] = ['window', 'dom', 'array', 'from', 'null', 'return', 'get', 'set', 'boolean', 'string', 'if', 'var', 'let', 'const', 'for', 'public', 'class', 'interface', 'new', 'import', 'as', 'private', 'while', 'case', 'switch', 'this', 'function', 'enum'];
// start strings which can be ignored in ts files because they are most likely part of a function/class and will obfuscate the overview
const commonKeywordStartsWith: string[] = ['copy', 'id', 'ready', 'cancel', 'build', 'finish', 'merge', 'clamp', 'construct', 'native', 'clear', 'update', 'parse', 'sanitize', 'render', 'has', 'equal', 'dispose', 'create', 'as', 'is', 'init', 'process', 'get', 'set'];
// paths to ignore while looking through node_modules 
const commonIgnorePaths: string[] = ['esm', 'testing', 'test', 'facade', 'backends', 'es5', 'es2015', 'umd'];
// all library (node_modules) paths which should always be ignored

//
const commonIgnoreLibraryPaths: string[] = <string[]>vscode.workspace.getConfiguration('genGetSet').get('ignoredLibraryPaths');
//
const ignoredLibraryList: string[] = <string[]>vscode.workspace.getConfiguration('genGetSet').get('ignoredNodeLibraries');
//
const ignoredImportList: string[] = <string[]>vscode.workspace.getConfiguration('genGetSet').get('ignoredImportList');
//
const ignoredDictionaryList: string[] = <string[]>vscode.workspace.getConfiguration('genGetSet').get('ignoredDictionaryList');

// all regexp matchers we use to analyze typescript documents
const matchers = {
    explicitExport: /export(.*)(function|class|type|interface|var|let|const|enum)\s/,
    commonWords: /([.?_:\'\"a-zA-Z0-9]{2,})/g,
    exports: /export[\s]+[\s]?[\=]?[\s]?(function|declare|abstract|class|type|interface|var|let|const|enum|[\s]+)*([a-zA-Z_$][0-9a-zA-Z_$]*)[\:|\(|\s|\;\<]/,
    imports: /import[\s]+[\*\{]*[\s]*([a-zA-Z\_\,\s]*)[\s]*[\}]*[\s]*from[\s]*[\'\"]([\S]*)[\'|\"]+/,
    typings: /declare[\s]+module[\s]+[\"|\']?([a-zA-Z_]*)[\"|\']?/
}

// search for keywords in the active document and match them with all indexed exports
// filter the list till there are only 'imports' left which we need for this active doc
// optional: add a single non mentioned 'nontype' and it will be mixed with the optimize
export function optimizeImports(exports: IExport[]) {
    const filteredExports = filterExports(exports);
    vscode.window.activeTextEditor.edit((builder) => {
        const lineCount = vscode.window.activeTextEditor.document.lineCount;
        // search for import-lines we can replace instead of adding another bunch of the same lines
        for (let i = 0; i < lineCount; i++) {
            const line = vscode.window.activeTextEditor.document.lineAt(i);
            const matches = line.text.match(matchers.imports);
            if (matches) {
                let _export = containsLibraryName(filteredExports, matches[2]) || containsSanitizedPath(filteredExports, matches[2]);
                if (_export !== null) {
                    const range = new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i + 1, 0));
                    builder.replace(range, createImportLine(_export));
                    // remove the updated import line from the list ...
                    filteredExports.splice(filteredExports.indexOf(_export), 1);
                    // ... and search for seperate libraryNames with the same exports and remove them (ex. angular has deprecated doubles)
                    const exportedNameList = matches[1].split(',').map(item => item.trim());
                    exportedNameList.forEach((name) => {
                        const _export = containsExportedName(filteredExports, name)
                        if (_export) filteredExports.splice(filteredExports.indexOf(_export), 1);
                    });
                }
            }
        }
        // all filtered exportes left are added as new imports
        for (let i = 0; i < filteredExports.length; i++) {
            builder.replace(new vscode.Position(0, 0), createImportLine(filteredExports[i]));
        }
    });
}

export function addSingleImport(exports: IExport[], name: string) {
    vscode.window.activeTextEditor.edit((builder) => {
        // if name is set add the entry on forehand
        // this entry is probably import only and not used yet within the document
        // this item is cloned from the normal filter list and altered
        const filteredExports: IExport[] = [];
        const lineCount = vscode.window.activeTextEditor.document.lineCount;
        const entry = containsExportedName(exports, name) || containsAsName(exports, name);
        const _export = cloneFromExport(path.parse(vscode.window.activeTextEditor.document.fileName).dir, entry);
        _export.exported.push(name);
        filteredExports.push(_export);
        for (let i = 0; i < lineCount; i++) {
            const line = vscode.window.activeTextEditor.document.lineAt(i);
            const matches = line.text.match(matchers.imports);
            if (matches) {
                // the matching line is re-build with previous imports so they do not dissapear
                let _export = containsLibraryName(filteredExports, matches[2]) || containsSanitizedPath(filteredExports, matches[2]);
                if (_export !== null) {
                    const others = matches[1].trim().split(',');
                    if (others.length > 0) others.forEach(o => _export.exported.push(o));
                    const range = new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i + 1, 0));
                    builder.replace(range, createImportLine(_export));
                    return;
                }
            }
        }
        builder.replace(new vscode.Position(0, 0), createImportLine(filteredExports[0]));
    });
}

// filter (ex. all exports found in the workspace) againt the active/open file in the editor
// create a list of imports needed based on words found in the open file
function filterExports(exports: IExport[]): IExport[] {
    const currentDir = path.parse(vscode.window.activeTextEditor.document.fileName).dir;
    let filteredExports: IExport[] = [];
    const file = {
        currentPos: vscode.window.activeTextEditor.selection.active,
        fileName: vscode.window.activeTextEditor.document.fileName,
        libraryName: path.parse(vscode.window.activeTextEditor.document.fileName).name,
        lineCount: vscode.window.activeTextEditor.document.lineCount
    }
    for (let i = 0; i < file.lineCount; i++) {
        // quick filters to skip lines fast without analyzing
        // import lines, comment lines or continues comment lines (wildcards) can be quick skipped.
        // no need to spend our precious cpu cycles :-)
        if (vscode.window.activeTextEditor.document.lineAt(i).isEmptyOrWhitespace) continue;
        let line = vscode.window.activeTextEditor.document.lineAt(i).text.trim();
        if (line.startsWith('import') || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;
        if (line.indexOf('//') !== -1) line = line.split('//')[0];
        const matches = line.match(matchers.commonWords);
        if (!matches) continue;
        // walk through each found common word on this line
        for (let j = 0; j < matches.length; j++) {
            // only process unquoted words which are not listed in the commonList
            if (matches[j].indexOf('\'') === -1 &&
                matches[j].indexOf('\"') === -1 &&
                checkIfValid(matches[j])) {
                // split method calls based on the dot, no need to sub-minimatch
                // we use intellisens for that :)
                const splitted = matches[j].split('.');
                const _word: string = splitted.length > 0 ? splitted[0] : matches[j];
                // now search the exports for this word
                for (let k = 0; k < exports.length; k++) {
                    // do not process exported items from this same file
                    if (exports[k].libraryName === file.libraryName) continue;
                    if ((exports[k].type === ExportType.LOCAL && exports[k].exported.indexOf(_word) !== -1) ||
                        (exports[k].type === ExportType.TYPING && _word === exports[k].asName) ||
                        (exports[k].type === ExportType.NODE && exports[k].exported.indexOf(_word) !== -1)) {
                        // check if the import was already added and this is an extra import from
                        // the same library (add it to exported) else add a new import to the list
                        let _export = containsLibraryName(filteredExports, exports[k].libraryName);
                        if (_export === null) {
                            _export = cloneFromExport(currentDir, exports[k]);
                            if (_export) filteredExports.push(_export);
                        }
                        // typing is a wildcard import, no need to add submodules
                        if (_export.type !== ExportType.TYPING) {
                            if (_export.exported.indexOf(_word) === -1) _export.exported.push(_word);
                        }
                    }
                }
            }
        }
    }
    return filteredExports;
}

function readLines(file: vscode.Uri) {
    return fs.readFileSync(file.fsPath).toString().split(/(\r?\n)/g);
}

// analyze all typescript (.ts) files within the workspace including
// node_modules and typings, this is promised and runs in he background
export function analyzeWorkspace(): Promise<IExport[]> {
    return new Promise((resolve, reject) => {
        const includeNode = vscode.workspace.getConfiguration('genGetSet').get('importNode');
        const includeTypings = vscode.workspace.getConfiguration('genGetSet').get('importTypings');
        vscode.workspace.findFiles('**/*.ts', '').then((files) => {
            if (files === undefined) return reject();
            let exports: IExport[] = [];
            for (let i = 0; i < files.length; i++) {
                // globally analyze the found .ts file and load all data for
                // a line to line analyzes
                const file = {
                    path: path.parse(files[i].fsPath),
                    dts: files[i].fsPath.endsWith('.d.ts')
                }

                let nodeModulesPosInPath: number;
                // analyze files based on their EType
                // TODO: Typings is now ALSO deprecated - remove later on?
                if (file.dts &&
                    file.path.dir.indexOf('typings' + path.sep) !== -1 &&
                    includeTypings) {
                    // Process d.ts files from the Typings directory
                    // they describe pure javascript node_modules with a 'module' tag
                    const lines = readLines(files[i]);
                    for (let k = 0; k < lines.length; k++) {
                        const line = lines[k];
                        const matches = line.match(matchers.typings);
                        if (matches && matches[1]) {
                            const asName = createAsName(matches[1].toString());
                            // don't add doubles (can happen) this is not yet supported
                            // TODO: make the system understand doubles (popup menu selection?)
                            if (containsAsName(exports, asName) === null) {
                                let _export: IExport = {
                                    libraryName: matches[1].toString(),
                                    path: file.path.dir,
                                    type: ExportType.TYPING,
                                    asName: asName
                                }
                                exports.push(_export);
                            }
                        }
                    }
                } else if (file.dts && file.path.dir.indexOf('@types' + path.sep) !== -1) {
                    // search the @types index file for a module name (first hit wins, like with lodash it is '_')
                    // if there is NO match use the name of the library itself
                    let asName = null;
                    let libraryName = file.path.dir.substring(file.path.dir.lastIndexOf(path.sep) + 1);
                    if (ignoredLibraryList.indexOf(libraryName) !== -1) continue;
                    // if (libraryName === 'node') continue; // quick fix to skip any node library for typings - these are now included in typescript
                    const lines = readLines(files[i]);
                    for (let k = 0; k < lines.length; k++) {
                        const line = lines[k];
                        const matches = line.match(matchers.typings);
                        if (matches && matches[1]) {
                            asName = createAsName(matches[1].toString());
                            break;
                        }
                    }
                    let _export: IExport = {
                        libraryName: libraryName,
                        path: file.path.dir,
                        type: ExportType.TYPING,
                        asName: asName || libraryName
                    }
                    exports.push(_export);
                } else if (file.dts &&
                    (nodeModulesPosInPath = file.path.dir.indexOf('node_modules' + path.sep)) !== -1 &&
                    includeNode) {
                    // skip common directories where we do not need to look
                    const lines = readLines(files[i]);
                    let validPath = true;
                    for (let z = 0; z < commonIgnorePaths.length; z++) {
                        if (file.path.dir.indexOf(path.sep + commonIgnorePaths[z] + path.sep, nodeModulesPosInPath) !== -1)
                            validPath = false;
                    }
                    // Process node_modules like Angular2 etc.
                    // these libraries contain their own d.ts files with 'export declares'
                    if (validPath) {
                        if (file.path.dir.indexOf('trans') !== -1) console.log(constructNodeLibraryName(file.path), file.path.dir);
                        let _export: IExport = {
                            libraryName: constructNodeLibraryName(file.path),
                            path: file.path.dir,
                            type: ExportType.NODE,
                            exported: []
                        }
                        for (let k = 0; k < lines.length; k++) {
                            const line = lines[k];
                            const matches = line.match(matchers.exports);
                            if (matches &&
                                checkIfValid(matches[2], line)) {
                                _export.exported.push(matches[2]);
                            }
                        }
                        exports.push(_export);
                    }
                } else if (!file.dts &&
                    file.path.dir.indexOf('node_modules/') === -1 &&
                    file.path.dir.indexOf(path.sep + '.') === -1 &&
                    file.path.dir.indexOf('typings/') === -1) {
                    // Process local .ts files
                    // these are your own source files who import by path
                    let _export: IExport = {
                        libraryName: file.path.name,
                        path: file.path.dir,
                        type: ExportType.LOCAL,
                        exported: []
                    }
                    const lines = readLines(files[i]);
                    for (let k = 0; k < lines.length; k++) {
                        const line = lines[k];
                        const matches = line.match(matchers.exports);
                        if (matches &&
                            checkIfValid(matches[2], line)) {
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
    let lastPathWithDTS = null;
    for (let i = tree.length; i >= node; i--) {
        let constructedPath = path.sep === '/' ? path.sep : '';
        for (let j = 0; j < i; j++) {
            constructedPath = constructedPath + tree[j] + '/';
        }
        let files = null;
        try { files = fs.readdirSync(constructedPath); } catch (err) {
            console.log('! path not found: ', constructedPath);
            continue;
        }

        if (ignoredDictionaryList.indexOf(tree[i]) !== -1) return null;

        // match d.ts files which have the same name as the library itself - some services like ng2-translate use this        
        files.forEach(file => {
            if (file.indexOf(tree[node] + '.d.ts') !== -1) {
                lastPathWithDTS = '';
                for (let j = node; j < i; j++) {
                    lastPathWithDTS = lastPathWithDTS + (lastPathWithDTS === '' ? '' : '/') + tree[j];
                }
                lastPathWithDTS = lastPathWithDTS + '/' + file.split('.d.ts')[0];
            }
        });

        if (files && files.indexOf('index.d.ts') !== -1) {
            let returnPath = '';
            for (let j = node; j < i; j++) {
                let foundIgnoredPath = false;
                commonIgnoreLibraryPaths.forEach(d => {
                    if (d === tree[j]) foundIgnoredPath = true;
                });
                if (!foundIgnoredPath) returnPath = returnPath + (returnPath === '' ? '' : '/') + tree[j];
            }
            return returnPath;
        }
    }

    // The above looks for an index.d.ts or <libraryName>.d.ts  When not found, fall back to just raw compiled ts library output
    if (!lastPathWithDTS && node < tree.length) { 
        let constructedPath = "";
        for (let j = node; j < tree.length; j++) {
            constructedPath = constructedPath + tree[j] + '/';
        }

        constructedPath += _path.name;

        if (constructedPath.endsWith('.d'))
            constructedPath = constructedPath.substr(0, constructedPath.length - 2);

        lastPathWithDTS = constructedPath;
    }

    return lastPathWithDTS;
}

// build the import line based on the given IExport
// there is a custom setting for using ' or "
function createImportLine(_export: IExport): string {
    let spacedImportLine = vscode.workspace.getConfiguration('genGetSet').get('spacedImportLine');
    let pathStringDelimiter = vscode.workspace.getConfiguration('genGetSet').get('pathStringDelimiter') || '\'';
    let txt = 'import ';
    if (_export.type === ExportType.LOCAL ||
        _export.type === ExportType.NODE) {
        txt += '{' + (spacedImportLine ? ' ' : '');
        for (let i = 0; i < _export.exported.length; i++) {
            if (i != 0) txt += ', ';
            txt += _export.exported[i];
        }
        txt += (spacedImportLine ? ' ' : '') + '} from ';
        let p;
        if (_export.type === ExportType.LOCAL)
            p = sanitizePath(_export.path, _export.libraryName);
        if (_export.type === ExportType.NODE)
            p = _export.libraryName;
        // sometimes exports are not correct due to the underlaying system
        // if 'p' is null this is a string indication :-)
        if (p) {
            txt += pathStringDelimiter + p + pathStringDelimiter;
        } else {
            return;
        }
    } else if (_export.type === ExportType.TYPING) {
        txt += '* as ' + _export.asName + ' from ';
        txt += pathStringDelimiter + _export.libraryName + pathStringDelimiter;
    }
    txt += ';\n';
    return txt;
}

// based on the location of the open file create a relative path
// to the imported file
function sanitizePath(p: string, n: string): string {
    if (!n) return null; // weird bug solved stopping from optimizing :-)
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

function checkIfValid(word: string, line?: string): boolean {
    let explicitMatch = line ? line.match(matchers.explicitExport) : null;
    if (ignoredImportList.indexOf(word) !== -1) return false;
    if (commonKeywordList.indexOf(word) === -1) {
        for (let i = 0; i < commonKeywordStartsWith.length; i++) {
            if (word.startsWith(commonKeywordStartsWith[i]) && !explicitMatch) {
                return false;
            }
        }
        return true;
    }
    return false;
}

function cloneFromExport(_currentDir: string, _export: IExport): IExport {
    const _path = path.relative(_currentDir, _export.path);
    if (_path !== null && _path !== 'null') {
        return {
            libraryName: _export.libraryName,
            type: _export.type,
            path: _path,
            asName: _export.asName,
            exported: []
        }
    }
    return null;
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
        const p = sanitizePath(exports[i].path, exports[i].libraryName);
        if (p === _path) {
            return exports[i];
        }
    }
    return null;
}

function containsExportedName(exports: IExport[], _name: string): IExport {
    for (let i = 0; i < exports.length; i++) {
        if (exports[i].exported) {
            if (exports[i].exported.indexOf(_name) !== -1) return exports[i];
        }
    }
    return null;
}
