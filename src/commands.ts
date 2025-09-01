import * as vscode from 'vscode';
import type { ChatContext } from './protocol';
import { EcaServer, EcaServerStatus } from './server';
import { EcaWebviewProvider } from './webview';

const manageHandler = async (
    server: EcaServer,
    _context: vscode.ExtensionContext,
) => {
    type Choice = vscode.QuickPickItem & { value?: string; };
    const choices: Choice[] = [];

    if (server.status === EcaServerStatus.Running || server.status === EcaServerStatus.Starting) {
        choices.push({ label: 'Stop ECA server', value: '::stop' });
    } else if (server.status === EcaServerStatus.Stopped || server.status === EcaServerStatus.Failed) {
        choices.push({ label: 'Start ECA server', value: '::start' });
    }

    const picker = vscode.window.createQuickPick();
    picker.items = choices;
    picker.title = 'ECA';
    picker.placeholder = 'Select an action';

    picker.show();

    const choice = await new Promise<Choice | undefined>((resolve) => {
        picker.onDidAccept(() => resolve(picker.selectedItems[0]));
        picker.onDidHide(() => resolve(undefined));
    });
    picker.dispose();

    if (!choice) {
        return;
    }

    switch (choice.value) {
        case '::start': {
            server.start();
            return;
        }
        case '::stop': {
            server.stop();
            return;
        }
    }
};

const getContextFile = async (): Promise<ChatContext | undefined> => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }
    return {
        type: 'file',
        path: editor.document.uri.fsPath,
    };
};

const getContextAtCursor = async (): Promise<ChatContext | undefined> => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const { selection, document } = editor;

    if (!selection.isEmpty) {
        return {
            type: 'file',
            path: document.uri.fsPath,
            linesRange: {
                start: selection.start.line,
                end: selection.end.line
            }
        };
    }

    // No selection: use document symbols to find function under cursor
    const symbols: vscode.DocumentSymbol[] =
        await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri);

    const position = selection.active;
    function findSymbolAtPosition(symbols: vscode.DocumentSymbol[]): vscode.DocumentSymbol | undefined {
        for (const symbol of symbols) {
            if (symbol.range.contains(position)) {
                return findSymbolAtPosition(symbol.children) || symbol;
            }
        }
        return undefined;
    }
    const symbol = findSymbolAtPosition(symbols);
    if (symbol) {
        return {
            type: 'file',
            path: document.uri.fsPath,
            linesRange: {
                start: symbol.range.start.line + 1,
                end: symbol.range.end.line + 1
            }
        };
    }
    return;
};

type RegisterCommandsParams = {
    server: EcaServer,
    webviewProvider: EcaWebviewProvider,
    context: vscode.ExtensionContext;
};

export const registerVSCodeCommands = (params: RegisterCommandsParams) => {
    return [
        vscode.commands.registerCommand('eca.manage', () => {
            manageHandler(params.server, params.context)
                .catch((err) => console.error('Failed to run manage command', err));
        }),
        vscode.commands.registerCommand('eca.start', () => {
            params.server.start();
        }),
        vscode.commands.registerCommand('eca.stop', () => {
            params.server.stop();
        }),
        vscode.commands.registerCommand('eca.chat.focus', () => {
            params.webviewProvider.focus('/');
        }),
        vscode.commands.registerCommand('eca.mcp-details.focus', () => {
            params.webviewProvider.focus('/mcp-details');
        }),
        vscode.commands.registerCommand('eca.chat.addContextCursor', async () => {
            const context = await getContextAtCursor();
            if (context) {
                params.webviewProvider.addChatContext(context);
            } else {
                vscode.window.showWarningMessage('No selection or function/method found at cursor.');
            }
        }),
        vscode.commands.registerCommand('eca.chat.addContextFile', async () => {
            const context = await getContextFile();
            if (context) {
                params.webviewProvider.addChatContext(context);
            } else {
                vscode.window.showWarningMessage('No opened file found.');
            }
        }),
    ];
};
