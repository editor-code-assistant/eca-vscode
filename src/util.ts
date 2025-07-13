import { https } from 'follow-redirects';
import * as fs from 'fs';
import * as url from 'url';
import * as vscode from "vscode";

export function randNonce() {
    const crypto = require("crypto");
    return crypto.randomUUID()
}

export function getExtensionUri(): vscode.Uri {
    return vscode.extensions.getExtension("editor-code-assistant.eca")!.extensionUri;
}

export async function fetchFromUrl(fullUrl: string): Promise<string> {
    const q = url.parse(fullUrl);
    return new Promise((resolve, reject) => {
        if (fullUrl.startsWith('file:')) {
            fs.readFile(url.fileURLToPath(fullUrl), 'utf8', (err, data) => {
                if (err) {
                    console.error(`Error reading file: ${err.message}`);
                    reject(err);
                    return;
                }
                resolve(data);
            });
        } else {
            https
                .get(
                    {
                        host: q.hostname,
                        path: q.pathname,
                        port: q.port,
                        headers: { 'user-agent': 'node.js' },
                    },
                    (res) => {
                        let data = '';
                        res.on('data', (chunk: any) => {
                            data += chunk;
                        });
                        res.on('end', () => {
                            resolve(data);
                        });
                    }
                )
                .on('error', (err: any) => {
                    console.error(`Error downloading file from ${url}: ${err.message}`);
                    reject(err);
                });
        }
    });
}
