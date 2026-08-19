// ============================================================
// Editor navigation — answers the ECA server's editor/getDefinition
// and editor/getReferences requests with VS Code's language providers,
// so the LLM can navigate code through whatever language extensions
// the user already has running.
//
// Wire positions are 1-based (UTF-16 code units, VS Code's native
// encoding); VS Code positions are 0-based. Conversions happen at this
// boundary only.
// ============================================================

import * as vscode from 'vscode';
import * as rpc from 'vscode-jsonrpc/node';
import * as ecaApi from './ecaApi';
import * as protocol from './protocol';

// How long after first touching a language we keep answering 'starting'
// for empty results, giving its language server time to initialize and
// register providers. The ECA server re-polls every ~2s within its own
// lspTimeoutSeconds budget (30s by default).
const STARTING_GRACE_MS = 15000;

type DefinitionResult = vscode.Location | vscode.LocationLink;

async function executeDefinitionProvider(uri: vscode.Uri, position: vscode.Position): Promise<DefinitionResult[]> {
    return await vscode.commands.executeCommand<DefinitionResult[]>(
        'vscode.executeDefinitionProvider', uri, position) ?? [];
}

function toOneBasedRange(range: vscode.Range): protocol.Range {
    return {
        start: { line: range.start.line + 1, character: range.start.character + 1 },
        end: { line: range.end.line + 1, character: range.end.character + 1 },
    };
}

function toEditorLocation(result: DefinitionResult): protocol.EditorLocation {
    if ('targetUri' in result) {
        // LocationLink: targetSelectionRange pinpoints the symbol name,
        // targetRange spans the whole definition. Prefer the former.
        const range = result.targetSelectionRange ?? result.targetRange;
        return { uri: result.targetUri.toString(), range: toOneBasedRange(range) };
    }
    return { uri: result.uri.toString(), range: toOneBasedRange(result.range) };
}

function locationKey(location: protocol.EditorLocation): string {
    return `${location.uri}:${location.range.start.line}:${location.range.start.character}`;
}

function errMsg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

export class EditorNav {
    // VS Code cannot tell "no provider registered (yet)" apart from "the
    // provider found nothing": both come back as an empty array. These
    // track, per languageId, whether empty results are believable
    // ('warm') or the language extension is likely still starting.
    private warmLanguages = new Set<string>();
    private firstTouch = new Map<string, number>();

    constructor(private readonly graceMs: number = STARTING_GRACE_MS) { }

    attach(connection: rpc.MessageConnection) {
        connection.onRequest(ecaApi.editorGetDefinition, (params: protocol.EditorGetDefinitionParams) =>
            this.getDefinition(params));
        connection.onRequest(ecaApi.editorGetReferences, (params: protocol.EditorGetReferencesParams) =>
            this.getReferences(params));
    }

    async getDefinition(params: protocol.EditorGetDefinitionParams): Promise<protocol.EditorGetDefinitionResult> {
        return this.navRequest(params.uri, params.position, async (uri, position) => {
            const definitions = await executeDefinitionProvider(uri, position);
            return definitions.map(toEditorLocation);
        });
    }

    async getReferences(params: protocol.EditorGetReferencesParams): Promise<protocol.EditorGetReferencesResult> {
        return this.navRequest(params.uri, params.position, async (uri, position) => {
            const references = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeReferenceProvider', uri, position) ?? [];
            let locations = references.map(toEditorLocation);
            // The built-in command always includes the declaration (the
            // ReferenceContext is not exposed), so honor
            // includeDeclaration=false by dropping locations that match
            // the symbol's definitions.
            if (params.includeDeclaration === false && locations.length > 0) {
                const definitions = await executeDefinitionProvider(uri, position);
                const declarationKeys = new Set(definitions.map(d => locationKey(toEditorLocation(d))));
                locations = locations.filter(l => !declarationKeys.has(locationKey(l)));
            }
            return locations;
        });
    }

    private async navRequest(
        rawUri: string,
        rawPosition: protocol.Position,
        run: (uri: vscode.Uri, position: vscode.Position) => Promise<protocol.EditorLocation[]>,
    ): Promise<protocol.EditorNavResult> {
        let uri: vscode.Uri;
        try {
            uri = vscode.Uri.parse(rawUri, true);
        } catch (err) {
            return { status: 'error', message: `Invalid uri '${rawUri}': ${errMsg(err)}` };
        }

        const uriKey = uri.toString();
        const wasAlreadyOpen = vscode.workspace.textDocuments.some(d => d.uri.toString() === uriKey);

        let document: vscode.TextDocument;
        try {
            // Loads the file in background (no editor tab) and, crucially,
            // fires `onLanguage` activation events: this is how a not yet
            // running language extension gets started for this file.
            document = await vscode.workspace.openTextDocument(uri);
        } catch (err) {
            return { status: 'error', message: `Cannot open '${rawUri}': ${errMsg(err)}` };
        }

        const languageId = document.languageId;
        if (!this.firstTouch.has(languageId)) {
            this.firstTouch.set(languageId, Date.now());
            // If this file (or another file of the same language) was open
            // before this request, the language extension activated long
            // ago: empty results are believable, not a boot symptom.
            if (wasAlreadyOpen ||
                vscode.workspace.textDocuments.some(d => d !== document && d.languageId === languageId)) {
                this.warmLanguages.add(languageId);
            }
        }

        const position = document.validatePosition(new vscode.Position(
            Math.max(0, rawPosition.line - 1),
            Math.max(0, rawPosition.character - 1)));

        let locations: protocol.EditorLocation[];
        try {
            locations = await run(uri, position);
        } catch (err) {
            return { status: 'error', message: errMsg(err) };
        }

        if (locations.length > 0) {
            this.warmLanguages.add(languageId);
            return { status: 'success', locations };
        }

        // Empty is ambiguous: a still-initializing language server and no
        // provider at all both yield []. Within a per-language grace
        // window answer 'starting' so the ECA server re-polls instead of
        // reporting a false "no results".
        if (!this.warmLanguages.has(languageId) && vscode.languages.getDiagnostics(uri).length > 0) {
            // Something already published diagnostics for this file, so
            // language tooling is alive.
            this.warmLanguages.add(languageId);
        }
        if (!this.warmLanguages.has(languageId)) {
            const elapsed = Date.now() - (this.firstTouch.get(languageId) ?? 0);
            if (elapsed < this.graceMs) {
                return { status: 'starting' };
            }
            this.warmLanguages.add(languageId);
        }
        return { status: 'success', locations: [] };
    }
}
