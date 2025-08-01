import * as vscode from 'vscode';
import * as protocol from './protocol';
import { EcaServerStatus } from './server';
import * as s from './session';
import * as util from './util';

export class EcaWebviewProvider implements vscode.WebviewViewProvider {
    public providerId = 'eca.webview';
    private _webview?: vscode.Webview;

    constructor(
        private readonly context: vscode.ExtensionContext,
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
                vscode.Uri.joinPath(extensionUri, "gui"),
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
                    this.configChanged();
                    return;
                }
                case 'chat/userPrompt': {
                    let session = s.getSession()!;
                    session.server.connection.sendRequest(protocol.chatPrompt, {
                        chatId: message.data.chatId,
                        message: message.data.prompt,
                        model: session.chatSelectedModel,
                        behavior: session.chatSelectedBehavior,
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
                case 'chat/selectedModelChanged': {
                    let session = s.getSession()!;
                    session.chatSelectedModel = message.data.value;
                    return;
                }
                case 'chat/selectedBehaviorChanged': {
                    let session = s.getSession()!;
                    session.chatSelectedBehavior = message.data.value;
                    return;
                }
                case 'chat/toolCallApprove': {
                    let session = s.getSession()!;
                    session.server.connection.sendNotification(protocol.chatToolCallApprove, {
                        chatId: message.data.chatId,
                        toolCallId: message.data.toolCallId,
                    });
                    return;
                }
                case 'chat/toolCallReject': {
                    let session = s.getSession()!;
                    session.server.connection.sendNotification(protocol.chatToolCallReject, {
                        chatId: message.data.chatId,
                        toolCallId: message.data.toolCallId,
                    });
                    return;
                }
                case 'chat/promptStop': {
                    let session = s.getSession()!;
                    session.server.connection.sendNotification(protocol.chatPromptStop, {
                        chatId: message.data.chatId,
                    });
                    return;
                }
                case 'chat/queryContext': {
                    let session = s.getSession()!;
                    session.server.connection.sendRequest(protocol.chatQueryContext, message.data)
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
                    session.server.connection.sendRequest(protocol.chatQueryCommands, message.data)
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
                    session.server.connection.sendRequest(protocol.chatDelete, {
                        chatId: message.data.chatId,
                    });
                    return;
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
        const vscodeMediaUrl: string = webview
            .asWebviewUri(vscode.Uri.joinPath(extensionUri, "gui", "public"))
            .toString();

        const codiconsUri = webview
            .asWebviewUri(vscode.Uri.joinPath(extensionUri, "gui", 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'))
            .toString();

        const isDev =
            this.context?.extensionMode === vscode.ExtensionMode.Development;
        if (!isDev) {
            scriptUri = webview
                .asWebviewUri(vscode.Uri.joinPath(extensionUri, "gui/dist/assets/index.js"))
                .toString();
            styleMainUri = webview
                .asWebviewUri(vscode.Uri.joinPath(extensionUri, "gui/dist/assets/index.css"))
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
            <script>window.vscodeMediaUrl = "${vscodeMediaUrl}"</script>
            <title>ECA</title>
            <link href="${styleMainUri}" rel="stylesheet">
            <link href="${codiconsUri}" rel="stylesheet" />
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
            type: 'chat/setBehaviors',
            data: {
                behaviors: session.chatBehaviors,
                selectedBehavior: session.chatSelectedBehavior,
            },
        });
        this._webview?.postMessage({
            type: 'chat/setModels',
            data: {
                models: session.models,
                selectedModel: session.chatSelectedModel
            },
        });
        this._webview?.postMessage({
            type: 'server/setWorkspaceFolders',
            data: session.workspaceFolders,
        });
    }

    configChanged() {
        const config = vscode.workspace.getConfiguration('eca');
        this._webview?.postMessage({
            type: 'config/updated',
            data: config,
        });
    }

    handleNewStatus(status: EcaServerStatus) {
        let enabled = status === EcaServerStatus.Running;

        if (enabled) {
            let session = s.getSession()!;
            this._webview?.postMessage({
                type: 'chat/setWelcomeMessage',
                data: {
                    message: session.chatWelcomeMessage,
                }
            });
        }
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
};
