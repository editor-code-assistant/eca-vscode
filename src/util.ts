import * as cp from 'child_process';
import { https } from 'follow-redirects';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as vscode from "vscode";

export function randUuid(): string {
    const crypto = require("crypto");
    return crypto.randomUUID();
}

export function getExtensionUri(): vscode.Uri {
    return vscode.extensions.getExtension("editor-code-assistant.eca")!.extensionUri;
}

export async function getUserShellEnv(): Promise<{ [key: string]: string }> {
    const shell = process.env.SHELL || (process.platform === 'win32' ? process.env.COMSPEC : '/bin/bash') || '/bin/bash';
    const shellArgs = process.platform === 'win32'
        ? ['/c', 'set'] // Windows: use `set` for env dump
        : ['-ilc', 'env']; // Unix: login + interactive, dump env

    return new Promise((resolve, reject) => {
        // timeout: a broken/interactive shell rc file must not block the
        // extension forever on "Starting ECA server".
        cp.execFile(shell, shellArgs, { encoding: 'utf8', timeout: 10000 }, (err, stdout) => {
            if (err) { return reject(err); };
            const env: { [key: string]: string } = {};
            stdout.split('\n').forEach((line) => {
                const i = line.indexOf('=');
                if (i > 0) {
                    const key = line.slice(0, i);
                    // sanitize: remove embedded NULs and CR, then trim
                    const value = line.slice(i + 1).replace(/\0/g, '').replace(/\r/g, '').trim();;
                    env[key] = value;
                }
            });
            resolve(env);
        });
    });
}

export async function fetchFromUrl(fullUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
        if (fullUrl.startsWith('file:')) {
            fs.readFile(fileURLToPath(fullUrl), 'utf8', (err, data) => {
                if (err) {
                    console.error(`Error reading file: ${err.message}`);
                    reject(err);
                    return;
                }
                resolve(data);
            });
        } else {
            // Pass the URL string through: follow-redirects parses it with the
            // WHATWG URL API, avoiding the deprecated url.parse() (DEP0169)
            // that newer Node versions warn about at runtime.
            https
                .get(fullUrl, { headers: { 'user-agent': 'node.js' } }, (res) => {
                    let data = '';
                    res.on('data', (chunk: any) => {
                        data += chunk;
                    });
                    res.on('end', () => {
                        resolve(data);
                    });
                })
                .on('error', (err: any) => {
                    console.error(`Error downloading file from ${fullUrl}: ${err.message}`);
                    reject(err);
                });
        }
    });
}
