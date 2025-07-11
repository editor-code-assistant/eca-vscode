import * as vscode from 'vscode';
import { getExtensionUri, randNonce } from './util';


export class ChatProvider implements vscode.WebviewViewProvider {
    public id = 'eca.chat';

    constructor(
        private readonly extensionContext: vscode.ExtensionContext,
    ) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken): void | Thenable<void> {
        const extensionUri = getExtensionUri();

        webviewView.webview.html = this.getWebviewContent(webviewView.webview, extensionUri);

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, "gui"),
                vscode.Uri.joinPath(extensionUri, "assets"),
            ],
            enableCommandUris: true,
        };
    }

    private getWebviewContent(
        webview: vscode.Webview,
        extensionUri: vscode.Uri,
    ): string {
        const nonce = randNonce();
        let scriptUri: string;
        let styleMainUri: string;
        const isDev =
            this.extensionContext?.extensionMode === vscode.ExtensionMode.Development;
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
};

export function focusChat() {
    vscode.commands.executeCommand('eca.chat.focus');
}
