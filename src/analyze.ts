import * as vscode from 'vscode';
import {IKlass, createMatcher} from './matchers'


export enum EAction {
  GETTER, SETTER, BOTH, NONE
}

function getKlass(items: IKlass[], name: string): IKlass {
  for (let i = 0; i < items.length; i++) {
    if (items[i].name === name) {
      return items[i];
    }
  }
  return null;
}

export function toItemList(items: IKlass[]): vscode.QuickPickItem[] {
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

export function processItemsConstructor(items: IKlass[]) {
  var matcher = createMatcher(vscode.window.activeTextEditor.document.languageId);
  vscode.window.activeTextEditor.edit((editBuiler) => {
    let pos = new vscode.Position(vscode.window.activeTextEditor.selection.active.line, 0);
    for (let i = 0; i < items.length; i++) {
      if (pos.isAfterOrEqual(items[i].start) || pos.isBeforeOrEqual(items[i].end)) {
        editBuiler.insert(pos, matcher.gen_constructor(items[i].items));
        return;
      }
    }
  });
}

export function processItemResult(items: IKlass[], result: vscode.QuickPickItem, action: EAction) {
  var matcher = createMatcher(vscode.window.activeTextEditor.document.languageId);
  if (result && result.description) {
    var klass = getKlass(items, result.description);
    if (klass) {
      for (let i = 0; i < klass.items.length; i++) {
        var item = klass.items[i];
        if (item && result.label === item.name) {
          vscode.window.activeTextEditor.edit((editBuilder) => {
            // add template code blocks before the cursor position's line number
            let pos = new vscode.Position(vscode.window.activeTextEditor.selection.active.line, 0);
            if (action == EAction.GETTER || action == EAction.BOTH) editBuilder.insert(pos, matcher.gen_getter(item));
            if (action == EAction.SETTER || action == EAction.BOTH) editBuilder.insert(pos, matcher.gen_setter(item));
          });
        }
      }
    }
  }
}

export function scanFile(action: EAction): IKlass[] {
  var items: IKlass[] = [];
  var matcher = createMatcher(vscode.window.activeTextEditor.document.languageId);
  if (matcher == null) {
    vscode.window.showWarningMessage('Sorry, this extension does not support current language.');
    return;
  }

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
      let matches = line.text.match(matcher.klass);
      if (matches) className = matches[1];
      classStart = true;
      bracketCount.open = 0;
      bracketCount.closed = 0;
      items.push({ name: className, start: new vscode.Position(i, 0), items: [], getters: [], setters: [] });
    }
    // within a class regex match for 'private' mentions
    // collect them and add them to the parent 'klass'
    let matches;
    let klass = getKlass(items, className);
    if (classStart) {
      matches = line.text.match(matcher.private_def);
      if (matches) {
        if (klass) klass.items.push({ name: matches[1], figure: matcher.figure(matches[1]), typeName: matches[2] });
      }
      matches = line.text.match(matcher.get_method);
      if (matches) {
        if (klass) klass.getters.push(matches[1]);
      }
      matches = line.text.match(matcher.set_method);
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
                  if (klass.items[i].figure == klass.getters[j]) {
                    klass.items.splice(i, 1);
                    break;
                  }
                }
              } else if (action == EAction.SETTER || action == EAction.BOTH) {
                for (let j = 0; j < klass.setters.length; j++) {
                  if (klass.items[i].figure === klass.setters[j]) {
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
  return items;
}