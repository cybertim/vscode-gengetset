import { DefinitionProvider } from './provider';
import * as vscode from 'vscode';
import { IExport, exportListContainsItem } from "./import";

export class CompleteActionProvider implements vscode.CodeActionProvider {

    public async provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext, token: vscode.CancellationToken): Promise<vscode.Command[]> {

        try {
            const keyword = document.getText(range);

            const cachedExports: IExport[] = await DefinitionProvider.instance.getCachedExportsAsync();

            if (exportListContainsItem(cachedExports, keyword)) {
                return [
                    {
                        arguments: [keyword],
                        command: 'genGetSet.addImport',
                        title: 'Add import for ' + keyword
                    }
                ];
            }

        } catch (err) {

        }
        
        return [];
    }
}