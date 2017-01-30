import { DefinitionProvider } from './provider';
import * as vscode from 'vscode';

export class CompleteActionProvider implements vscode.CodeActionProvider {
    public provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext, token: vscode.CancellationToken): Promise<vscode.Command[]> {
        return new Promise((resolve, reject) => {
            // optimizeImports(DefinitionProvider.instance.cachedExports, pickedItem.label);
            const keyword = document.getText(range);
            if (DefinitionProvider.instance.containsItem(keyword)) {
                resolve([
                    {
                        arguments: [keyword],
                        command: 'genGetSet.addImport',
                        title: 'Add import for ' + keyword
                    }
                ]);
            } else {
                resolve([]);
            }
        });
    }
}