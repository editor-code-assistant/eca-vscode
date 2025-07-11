import * as vscode from "vscode";

export function randNonce() {
    const crypto = require("crypto");
    return crypto.randomUUID()
}

export function getExtensionUri(): vscode.Uri {
    return vscode.extensions.getExtension("editor-code-assistant.eca")!.extensionUri;
}
