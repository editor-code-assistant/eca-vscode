import * as vscode from 'vscode';


export class ChatProvider implements vscode.WebviewViewProvider {
    public id = 'eca.chat';

    async resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken): Promise<void> {

    }

};

export function focusChat() {
   vscode.commands.executeCommand('eca.chat.focus')
}
