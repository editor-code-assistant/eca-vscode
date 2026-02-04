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

const getContextAtCursor = async (): Promise<ChatContext | undefined> => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const { selection, document } = editor;

    if (!selection.isEmpty) {
        return {
            type: 'file',
            path: document.uri.fsPath,
            linesRange: {
                start: selection.start.line + 1,
                end: selection.end.line + 1
            }
        };
    }

    // No selection: use full file
    return {
        type: 'file',
        path: document.uri.fsPath,
    };
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
            params.webviewProvider.focusPrompt();
        }),
        vscode.commands.registerCommand('eca.webview.focus', () => {
            params.webviewProvider.focus('/');
            params.webviewProvider.focusPrompt();
        }),
        vscode.commands.registerCommand('eca.mcp-details.focus', () => {
            params.webviewProvider.focus('/mcp-details');
        }),
        vscode.commands.registerCommand('eca.chat.addContextToSystemPrompt', async () => {
            const context = await getContextAtCursor();
            if (context) {
                params.webviewProvider.addContextToSystemPrompt(context);
            } else {
                vscode.window.showWarningMessage('No selection or function/method found at cursor.');
            }
        }),
        vscode.commands.registerCommand('eca.chat.send-prompt-new-chat', async () => {
            const prompt = await vscode.window.showInputBox({
                prompt: 'Enter your prompt',
                placeHolder: 'Ask, plan, build...',
            });
            if (prompt) {
                params.webviewProvider.focus('/');
                params.webviewProvider.createNewChat();
                params.webviewProvider.sendPromptToCurrentChat(prompt);
            }
        }),
        vscode.commands.registerCommand('eca.chat.send-prompt', async () => {
            const prompt = await vscode.window.showInputBox({
                prompt: 'Enter your prompt',
                placeHolder: 'Ask, plan, build...',
            });
            if (prompt) {
                params.webviewProvider.focus('/');
                params.webviewProvider.sendPromptToCurrentChat(prompt);
            }
        }),
    ];
};
