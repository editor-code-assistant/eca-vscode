// ============================================================
// Editor actions — global-config read/write/open helpers
//
// Ported from eca-desktop's src/main/editor-actions.ts + the
// `getGlobalConfigPath` bit of its constants.ts. Keeps the same
// semantics so the Settings → Global Config tab behaves identically
// across clients.
// ============================================================

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    parse as jsoncParse,
    printParseErrorCode,
    type ParseError,
} from 'jsonc-parser';

export interface EditorReadGlobalConfigResult {
    /** Raw file contents. Empty string when the file does not exist yet. */
    contents: string;
    /** Absolute path resolved on the main side. */
    path: string;
    /** Whether the file exists on disk. */
    exists: boolean;
    /** Populated if an IO error occurred. */
    error?: string;
}

export interface EditorWriteGlobalConfigData {
    contents: string;
}

export interface EditorWriteGlobalConfigResult {
    ok: boolean;
    path?: string;
    error?: string;
}

// ── Path resolution ──

/**
 * Resolves the absolute path to the ECA global config JSON file.
 *
 * Resolution order:
 *   1. `ECA_CONFIG_PATH` environment variable (absolute path), if set.
 *   2. `$XDG_CONFIG_HOME/eca/config.json` if `XDG_CONFIG_HOME` is set.
 *   3. Platform default:
 *      - darwin:  `~/Library/Application Support/eca/config.json`
 *      - win32:   `%APPDATA%\eca\config.json` (falls back to `~/.config/eca/config.json`)
 *      - others:  `~/.config/eca/config.json`
 *
 * Note: this does not touch the filesystem. Creation is the caller's
 * responsibility.
 */
export function getGlobalConfigPath(): string {
    const override = process.env.ECA_CONFIG_PATH;
    if (override && override.trim().length > 0) {
        return override;
    }

    const xdg = process.env.XDG_CONFIG_HOME;
    if (xdg && xdg.trim().length > 0) {
        return path.join(xdg, 'eca', 'config.json');
    }

    if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'eca', 'config.json');
    }

    if (process.platform === 'win32') {
        const appData = process.env.APPDATA;
        if (appData && appData.trim().length > 0) {
            return path.join(appData, 'eca', 'config.json');
        }
    }

    return path.join(os.homedir(), '.config', 'eca', 'config.json');
}

// ── Global config helpers ──

const EMPTY_GLOBAL_CONFIG = '{}\n';

/**
 * Ensures the global config file exists. Creates parent dirs and seeds the
 * file with `{}` if missing, so `showTextDocument` and subsequent reads
 * always succeed. Returns the absolute path.
 */
function ensureGlobalConfigExists(): string {
    const configPath = getGlobalConfigPath();
    if (!fs.existsSync(configPath)) {
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
        fs.writeFileSync(configPath, EMPTY_GLOBAL_CONFIG, 'utf-8');
    }
    return configPath;
}

/**
 * Opens the ECA global config file in a VS Code editor tab. Creates the
 * file (seeded with `{}`) if missing so the OS does not error on a missing
 * path. Surfaces IO errors through `vscode.window.showErrorMessage`.
 */
export function openGlobalConfig(): void {
    try {
        const configPath = ensureGlobalConfigExists();
        const fileUri = vscode.Uri.file(configPath);
        vscode.window.showTextDocument(fileUri);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to open global config: ${message}`);
    }
}

/**
 * Reads the ECA global config file from disk. Never throws: if the file does
 * not exist yet, returns `{ contents: '', exists: false }` so the UI can seed
 * a blank editor without a scary error banner. A read error (EPERM, etc.)
 * is returned in `error`.
 */
export function readGlobalConfig(): EditorReadGlobalConfigResult {
    const configPath = getGlobalConfigPath();
    if (!fs.existsSync(configPath)) {
        return { contents: '', path: configPath, exists: false };
    }
    try {
        const contents = fs.readFileSync(configPath, 'utf-8');
        return { contents, path: configPath, exists: true };
    } catch (err) {
        console.error('[EditorActions] readGlobalConfig failed:', err);
        return {
            contents: '',
            path: configPath,
            exists: true,
            error: (err as Error).message,
        };
    }
}

// Hard cap on global-config size. 1 MB is wildly more than any
// realistic hand-authored JSONC config; rejecting here prevents a
// runaway renderer payload from wedging the extension host.
const MAX_GLOBAL_CONFIG_BYTES = 1_048_576;

/**
 * Writes the ECA global config file after validating that the contents
 * parse as JSONC (JSON with Comments — `//`, `/* … *\/`, and trailing
 * commas tolerated, matching what the ECA server accepts). Writes
 * atomically via a temp file + rename so a mid-write crash does not leave
 * a truncated file. On parse failure the file on disk is left untouched
 * and `{ ok: false, error }` is returned.
 */
export function writeGlobalConfig(data: EditorWriteGlobalConfigData): EditorWriteGlobalConfigResult {
    if (Buffer.byteLength(data.contents, 'utf-8') > MAX_GLOBAL_CONFIG_BYTES) {
        return { ok: false, error: 'Config file too large (max 1MB)' };
    }

    const errors: ParseError[] = [];
    jsoncParse(data.contents, errors, {
        allowTrailingComma: true,
        allowEmptyContent: true,
    });
    if (errors.length > 0) {
        const first = errors[0];
        return {
            ok: false,
            error: `Invalid JSONC: ${printParseErrorCode(first.error)} at offset ${first.offset}`,
        };
    }

    const configPath = getGlobalConfigPath();
    try {
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
        const tmpPath = `${configPath}.tmp-${process.pid}-${Date.now()}`;
        fs.writeFileSync(tmpPath, data.contents, 'utf-8');
        fs.renameSync(tmpPath, configPath);
        return { ok: true, path: configPath };
    } catch (err) {
        console.error('[EditorActions] writeGlobalConfig failed:', err);
        return { ok: false, error: (err as Error).message };
    }
}
