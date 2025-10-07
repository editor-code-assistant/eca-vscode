import * as vscode from 'vscode';
import * as ecaApi from './ecaApi';
import * as protocol from './protocol';
import { EcaServerStatus } from './server';
import * as s from './session';
import * as util from './util';

export class EcaWebviewProvider implements vscode.WebviewViewProvider {
    public providerId = 'eca.webview';
    private _webview?: vscode.Webview;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly _channel: vscode.OutputChannel,
    ) {}

    get webview() {
        return this._webview;
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken): void | Thenable<void> {
        this._webview = webviewView.webview;

        const extensionUri = util.getExtensionUri();

        this._webview.html = this.getWebviewContent(this._webview, extensionUri);

        this._webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, "eca-webview"),
                vscode.Uri.joinPath(extensionUri, "assets"),
            ],
            enableCommandUris: true,
        };

        this._webview.onDidReceiveMessage(message => {
            switch (message.type) {
                case 'webview/ready': {
                    let session = s.getSession()!;
                    this.sessionChanged(session);
                    this.handleNewStatus(session.server.status);
                    this.configUpdated(undefined);
                    // get opened editor file path
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        this.onFileFocused(editor);
                    }
                    return;
                }
                case 'chat/userPrompt': {
                    let session = s.getSession()!;
                    session.server.connection.sendRequest(ecaApi.chatPrompt, {
                        chatId: message.data.chatId,
                        message: message.data.prompt,
                        model: message.data.model,
                        behavior: message.data.behavior,
                        requestId: message.data.requestId.toString(),
                        contexts: message.data.contexts,
                    }).then((result) => {
                        this._webview?.postMessage({
                            type: 'chat/newChat',
                            data: { id: result.chatId }
                        });
                    });

                    return;
                }
                case 'chat/toolCallApprove': {
                    let session = s.getSession()!;
                    session.server.connection.sendNotification(ecaApi.chatToolCallApprove, {
                        chatId: message.data.chatId,
                        toolCallId: message.data.toolCallId,
                        save: message.data.save,
                    });
                    return;
                }
                case 'chat/toolCallReject': {
                    let session = s.getSession()!;
                    session.server.connection.sendNotification(ecaApi.chatToolCallReject, {
                        chatId: message.data.chatId,
                        toolCallId: message.data.toolCallId,
                    });
                    return;
                }
                case 'chat/promptStop': {
                    let session = s.getSession()!;
                    session.server.connection.sendNotification(ecaApi.chatPromptStop, {
                        chatId: message.data.chatId,
                    });
                    return;
                }
                case 'chat/queryContext': {
                    let session = s.getSession()!;
                    session.server.connection.sendRequest(ecaApi.chatQueryContext, message.data)
                        .then((result) => {
                            this._webview?.postMessage({
                                type: 'chat/queryContext',
                                data: result
                            });
                        });
                    return;
                }
                case 'chat/queryCommands': {
                    let session = s.getSession()!;
                    session.server.connection.sendRequest(ecaApi.chatQueryCommands, message.data)
                        .then((result) => {
                            this._webview?.postMessage({
                                type: 'chat/queryCommands',
                                data: result
                            });
                        });
                    return;
                }
                case 'chat/delete': {
                    let session = s.getSession()!;
                    session.server.connection.sendRequest(ecaApi.chatDelete, {
                        chatId: message.data.chatId,
                    });
                    return;
                }
                case 'mcp/startServer': {
                    let session = s.getSession()!;
                    session.server.connection.sendNotification(ecaApi.mcpStartServer, {
                        name: message.data.name,
                    });
                    return;
                }
                case 'mcp/stopServer': {
                    let session = s.getSession()!;
                    session.server.connection.sendNotification(ecaApi.mcpStopServer, {
                        name: message.data.name,
                    });
                    return;
                }
                case 'editor/readInput': {
                    vscode.window.showInputBox({
                        prompt: message.data.message,
                        placeHolder: 'Enter the value',
                    }).then((userInput) => {
                        this._webview?.postMessage({
                            type: 'editor/readInput',
                            data: {
                                requestId: message.data.requestId,
                                value: userInput,
                            }
                        });
                    });
                    return;
                }
                case 'editor/openFile': {
                    const fileUri = vscode.Uri.file(message.data.path);
                    vscode.window.showTextDocument(fileUri);
                }
                case 'editor/openServerLogs': {
                    this._channel.show();
                }
            }
        });
    }

    getWebviewContent(
        webview: vscode.Webview,
        extensionUri: vscode.Uri,
    ): string {
        const nonce = util.randUuid();
        let scriptUri: string;
        let styleMainUri: string;
        const mediaUrl: string = webview
            .asWebviewUri(vscode.Uri.joinPath(extensionUri, "eca-webview", "public"))
            .toString();

        const isDev =
            this.context?.extensionMode === vscode.ExtensionMode.Development;
        if (!isDev) {
            scriptUri = webview
                .asWebviewUri(vscode.Uri.joinPath(extensionUri, "eca-webview/dist/assets/index.js"))
                .toString();
            styleMainUri = webview
                .asWebviewUri(vscode.Uri.joinPath(extensionUri, "eca-webview/dist/assets/index.css"))
                .toString();
        } else {
            scriptUri = "http://localhost:5173/src/main.tsx";
            styleMainUri = "http://localhost:5173/src/index.css";
        }

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script>const vscode = acquireVsCodeApi();</script>
            <script>window.mediaUrl = "${mediaUrl}"</script>
            <title>ECA</title>
            <link href="${styleMainUri}" rel="stylesheet">
        </head>
        <body>
            <div id="root"></div>

            ${isDev ? `<script type="module">
                import RefreshRuntime from "http://localhost:5173/@react-refresh"
                RefreshRuntime.injectIntoGlobalHook(window)
                window.$RefreshReg$ = () => {}
                window.$RefreshSig$ = () => (type) => type
                window.__vite_plugin_react_preamble_installed__ = true
                </script>`
                : ""
            }

            <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
            <script>
              localStorage.setItem("editor", '"vscode"');
            </script>
        </body>
        </html>`;
    }

    contentReceived(params: protocol.ChatContentReceivedParams) {
        this._webview?.postMessage({
            type: 'chat/contentReceived',
            data: params
        });
    }

    toolServerUpdated(params: protocol.ToolServerUpdatedParams) {
        let session = s.getSession();

        if (session) {
            session.mcpServers[params.name] = params;

            this._webview?.postMessage({
                type: 'tool/serversUpdated',
                data: Object.values(session.mcpServers),
            });
        }
    }

    sessionChanged(session: s.Session) {
        this._webview?.postMessage({
            type: 'server/setWorkspaceFolders',
            data: session.workspaceFolders,
        });
    }

    configUpdated(params?: protocol.ConfigUpdatedParams) {
        const config = vscode.workspace.getConfiguration('eca');
        this._webview?.postMessage({
            type: 'config/updated',
            data: { ...params, ...config },
        });
    }

    handleNewStatus(status: EcaServerStatus) {
        this._webview?.postMessage({
            type: 'server/statusChanged',
            data: status,
        });
    }

    focus(focus?: string) {
        vscode.commands.executeCommand('eca.webview.focus');
        if (focus) {
            this._webview?.postMessage({
                type: 'navigateTo',
                data: {
                    path: focus,
                }
            });
        };
    }
    addChatContext(chatContext: protocol.ChatContext) {
        this._webview?.postMessage({
            type: 'chat/addContext',
            data: chatContext,
        });
    }

    onFileFocused(editor: vscode.TextEditor) {
        const selection = editor.selection;
        this._webview?.postMessage({
            type: 'editor/focusChanged',
            data: {
                type: 'fileFocused',
                path: editor.document.uri.fsPath,
                position: {
                    start: {
                        line: selection.start.line, character: selection.start.character
                    },
                    end: {
                        line: selection.end.line, character: selection.end.character
                    }
                }
            },
        });
    }
};
