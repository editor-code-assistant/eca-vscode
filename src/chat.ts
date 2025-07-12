import * as vscode from 'vscode';
import * as protocol from './protocol';
import * as s from './session';
import { getExtensionUri, randNonce } from './util';

export class ChatProvider implements vscode.WebviewViewProvider {
    public id = 'eca.chat';
    private _requestId = 0;
    private _webview!: vscode.Webview;

    constructor(
        private readonly context: vscode.ExtensionContext,
    ) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken): void | Thenable<void> {
        const extensionUri = getExtensionUri();
        this._webview = webviewView.webview;

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
            if (message.type === 'chat/userPrompt') {
                let session = s.getSession()!;

                session.connection.sendRequest(protocol.chatPrompt, {
                    message: message.data.prompt,
                    requestId: (this._requestId++).toString(),
                }).then((result) => {
                    // TODO
                    console.log(result);
                });
            }
        });
    }

    private getWebviewContent(
        webview: vscode.Webview,
        extensionUri: vscode.Uri,
    ): string {
        const nonce = randNonce();
        let scriptUri: string;
        let styleMainUri: string;
        const isDev =
            this.context?.extensionMode === vscode.ExtensionMode.Development;
        if (!isDev) {
            scriptUri = webview
                .asWebviewUri(vscode.Uri.joinPath(extensionUri, "gui/assets/index.js"))
                .toString();
            styleMainUri = webview
                .asWebviewUri(vscode.Uri.joinPath(extensionUri, "gui/assets/index.css"))
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
        </body>
        </html>`;
    }

    contentReceived(params: protocol.ChatContentReceivedParams) {
        this._webview.postMessage({
            type: 'chat/contentReceived',
            data: params
        });

    }

};

export function focusChat() {
    vscode.commands.executeCommand('eca.chat.focus');
}
