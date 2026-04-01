import * as vscode from 'vscode';
import * as ecaApi from './ecaApi';
import * as protocol from './protocol';
import { EcaServerStatus } from './server';
import * as s from './session';
import * as util from './util';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export class EcaWebviewProvider implements vscode.WebviewViewProvider {
    public providerId = 'eca.webview';
    private _webview?: vscode.Webview;
    private _webviewView?: vscode.WebviewView;

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
        this._webviewView = webviewView;
        this._webview = webviewView.webview;

        const extensionUri = util.getExtensionUri();

        this._webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, "eca-webview"),
                vscode.Uri.joinPath(extensionUri, "assets"),
            ],
            enableCommandUris: true,
        };

        this._webview.html = this.getWebviewContent(this._webview, extensionUri);

        this._webview.onDidReceiveMessage(async message => {
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
                        agent: message.data.agent,
                        variant: message.data.variant,
                        trust: message.data.trust,
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
                    session.server.connection.sendNotification(ecaApi.chatSelectedModelChanged, {
                        model: message.data.model,
                        variant: message.data.variant,
                    });
                    return;
                }
                case 'chat/selectedAgentChanged': {
                    let session = s.getSession()!;
                    session.server.connection.sendNotification(ecaApi.chatSelectedAgentChanged, {
                        agent: message.data.agent,
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
                case 'chat/promptSteer': {
                    let session = s.getSession()!;
                    session.server.connection.sendNotification(ecaApi.chatPromptSteer, {
                        chatId: message.data.chatId,
                        message: message.data.message,
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
                case 'chat/queryFiles': {
                    let session = s.getSession()!;
                    session.server.connection.sendRequest(ecaApi.chatQueryFiles, message.data)
                        .then((result) => {
                            this._webview?.postMessage({
                                type: 'chat/queryFiles',
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
                case 'chat/rollback': {
                    let session = s.getSession()!;
                    const rollbackBoth = 'Rollback messages and changes done by tool calls';
                    const rollbackMessages = 'Rollback only messages';
                    const rollbackTools = 'Rollback only changes done by tool calls';
                    vscode.window.showQuickPick([rollbackBoth, rollbackMessages, rollbackTools], {
                        placeHolder: 'Select which rollback type',
                    }).then((choice) => {
                        const getInclude = () => {
                            switch (choice) {
                                case rollbackBoth: return ['messages', 'tools'];
                                case rollbackMessages: return ['messages'];
                                case rollbackTools: return ['tools'];
                                default: return '';
                            }
                        }

                        const include = getInclude();

                        if (include !== '') {
                            session.server.connection.sendRequest(ecaApi.chatRollback, {
                                chatId: message.data.chatId,
                                contentId: message.data.contentId,
                                include: getInclude(),
                            });
                        }
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
                case 'mcp/connectServer': {
                    let session = s.getSession()!;
                    session.server.connection.sendNotification(ecaApi.mcpConnectServer, {
                        name: message.data.name,
                    });
                    return;
                }
                case 'mcp/logoutServer': {
                    let session = s.getSession()!;
                    session.server.connection.sendNotification(ecaApi.mcpLogoutServer, {
                        name: message.data.name,
                    });
                    return;
                }
                case 'mcp/disableServer': {
                    let session = s.getSession()!;
                    session.server.connection.sendNotification(ecaApi.mcpDisableServer, {
                        name: message.data.name,
                    });
                    return;
                }
                case 'mcp/enableServer': {
                    let session = s.getSession()!;
                    session.server.connection.sendNotification(ecaApi.mcpEnableServer, {
                        name: message.data.name,
                    });
                    return;
                }
                case 'mcp/updateServer': {
                    let session = s.getSession()!;
                    session.server.connection.sendRequest(ecaApi.mcpUpdateServer, {
                        name: message.data.name,
                        ...(message.data.command && { command: message.data.command }),
                        ...(message.data.args && { args: message.data.args }),
                        ...(message.data.url && { url: message.data.url }),
                    }).then((result) => {
                        this._webview?.postMessage({
                            type: 'mcp/updateServer',
                            data: { requestId: message.data.requestId, ...result },
                        });
                    });
                    return;
                }
                case 'providers/list': {
                    let session = s.getSession()!;
                    const provListResult = await session.server.connection.sendRequest(ecaApi.providersList, message.data);
                    this._webview?.postMessage({ type: 'providers/list', data: { ...provListResult, requestId: message.data.requestId } });
                    return;
                }
                case 'providers/login': {
                    let session = s.getSession()!;
                    const provLoginResult = await session.server.connection.sendRequest(ecaApi.providersLogin, message.data);
                    this._webview?.postMessage({ type: 'providers/login', data: { ...provLoginResult, requestId: message.data.requestId } });
                    return;
                }
                case 'providers/loginInput': {
                    let session = s.getSession()!;
                    const provLoginInputResult = await session.server.connection.sendRequest(ecaApi.providersLoginInput, message.data);
                    this._webview?.postMessage({ type: 'providers/loginInput', data: { ...provLoginInputResult, requestId: message.data.requestId } });
                    return;
                }
                case 'providers/logout': {
                    let session = s.getSession()!;
                    const provLogoutResult = await session.server.connection.sendRequest(ecaApi.providersLogout, message.data);
                    this._webview?.postMessage({ type: 'providers/logout', data: { ...provLogoutResult, requestId: message.data.requestId } });
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
                    return;
                }
                case 'editor/saveFile': {
                    const defaultName = message.data.defaultName || 'chat-export.md';
                    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
                    const defaultUri = workspaceUri
                        ? vscode.Uri.joinPath(workspaceUri, defaultName)
                        : vscode.Uri.file(path.join(os.homedir(), defaultName));
                    vscode.window.showSaveDialog({
                        defaultUri,
                        filters: { 'Markdown': ['md'], 'All Files': ['*'] },
                    }).then((uri) => {
                        if (uri) {
                            vscode.workspace.fs.writeFile(uri, Buffer.from(message.data.content, 'utf-8'));
                        }
                    });
                    return;
                }
                case 'editor/saveClipboardImage': {
                    const { base64Data, mimeType, requestId } = message.data;
                    const extMap: { [key: string]: string } = {
                        'image/png': 'png',
                        'image/jpeg': 'jpg',
                        'image/jpg': 'jpg',
                        'image/gif': 'gif',
                        'image/webp': 'webp',
                        'image/svg+xml': 'svg',
                    };
                    const ext = extMap[mimeType] || 'png';
                    const tmpPath = path.join(os.tmpdir(), `eca-screenshot-${Date.now()}.${ext}`);
                    try {
                        const buffer = Buffer.from(base64Data, 'base64');
                        fs.writeFileSync(tmpPath, buffer);
                        this._webview?.postMessage({
                            type: 'editor/saveClipboardImage',
                            data: { requestId, path: tmpPath },
                        });
                    } catch (error) {
                        const msg = error instanceof Error ? error.message : String(error);
                        vscode.window.showErrorMessage(`Failed to save clipboard image: ${msg}`);
                    }
                    return;
                }
                case 'editor/openUrl': {
                    const url = vscode.Uri.parse(message.data.url);
                    vscode.env.openExternal(url);
                    return;
                }
                case 'editor/openServerLogs': {
                    this._channel.show();
                    return;
                }
                case 'editor/openGlobalConfig': {
                    const homedir = os.homedir();
                    const configHome = process.env.XDG_CONFIG_HOME || path.join(homedir, '.config');
                    const configFilePath = path.join(configHome, 'eca', 'config.json');
                    const configDir = path.dirname(configFilePath);

                    try {
                        if (!fs.existsSync(configDir)) {
                            fs.mkdirSync(configDir, { recursive: true });
                        }

                        if (!fs.existsSync(configFilePath)) {
                            fs.writeFileSync(configFilePath, '{}');
                        }
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        vscode.window.showErrorMessage(`Failed to prepare global config: ${message}`);
                        return;
                    }

                    const fileUri = vscode.Uri.file(configFilePath);
                    vscode.window.showTextDocument(fileUri);
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

        const cspSource = webview.cspSource;

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline' ${isDev ? "http://localhost:5173" : ""}; script-src 'nonce-${nonce}' ${isDev ? "'unsafe-eval' http://localhost:5173" : ""}; img-src ${cspSource} data:; font-src ${cspSource} ${isDev ? "http://localhost:5173" : ""}; connect-src ${isDev ? "ws://localhost:5173 http://localhost:5173" : ""};">
            <script nonce="${nonce}">const vscode = acquireVsCodeApi();</script>
            <script nonce="${nonce}">window.mediaUrl = "${mediaUrl}"</script>
            <title>ECA</title>
            <link href="${styleMainUri}" rel="stylesheet">
        </head>
        <body>
            <div id="root"></div>

            ${isDev ? `<script type="module" nonce="${nonce}">
                import RefreshRuntime from "http://localhost:5173/@react-refresh"
                RefreshRuntime.injectIntoGlobalHook(window)
                window.$RefreshReg$ = () => {}
                window.$RefreshSig$ = () => (type) => type
                window.__vite_plugin_react_preamble_installed__ = true
                </script>`
                : ""
            }

            <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
            <script nonce="${nonce}">
              localStorage.setItem("editor", '"vscode"');
            </script>
        </body>
        </html>`;
    }

    chatContentReceived(params: protocol.ChatContentReceivedParams) {
        this._webview?.postMessage({
            type: 'chat/contentReceived',
            data: params
        });
    }

    chatCleared(params: protocol.ChatClearedParams) {
        this._webview?.postMessage({
            type: 'chat/cleared',
            data: params
        });
    }

    chatDeleted(params: protocol.ChatDeletedParams) {
        this._webview?.postMessage({
            type: 'chat/deleted',
            data: params.chatId
        });
    }

    chatOpened(params: protocol.ChatOpenedParams) {
        this._webview?.postMessage({
            type: 'chat/opened',
            data: params
        });
    }

    chatStatusChanged(params: protocol.ChatStatusChangedParams) {
        this._webview?.postMessage({
            type: 'chat/statusChanged',
            data: params
        });
    }

    providersUpdated(params: any) {
        this._webview?.postMessage({ type: 'providers/updated', data: params });
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
        this._webviewView?.show(true);
        if (focus) {
            this._webview?.postMessage({
                type: 'navigateTo',
                data: {
                    path: focus,
                }
            });
        };
    }
    addContextToSystemPrompt(chatContext: protocol.ChatContext) {
        this._webview?.postMessage({
            type: 'chat/addContextToSystemPrompt',
            data: chatContext,
        });
    }

    focusPrompt() {
        this._webview?.postMessage({
            type: 'chat/focusPrompt',
        });
    }

    createNewChat() {
        this._webview?.postMessage({
            type: 'chat/createNewChat',
        });
    }

    sendPromptToCurrentChat(prompt: string) {
        this._webview?.postMessage({
            type: 'chat/sendPromptToCurrentChat',
            data: { prompt },
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
                        line: selection.start.line + 1, character: selection.start.character + 1
                    },
                    end: {
                        line: selection.end.line + 1, character: selection.end.character + 1
                    }
                }
            },
        });
    }
};
