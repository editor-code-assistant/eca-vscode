import * as vscode from 'vscode';
import * as rpc from 'vscode-jsonrpc/node';
import * as ecaApi from './ecaApi';
import * as protocol from './protocol';
import * as util from './util';

// A single rewrite streaming session, tied to one editor + selection
type RewriteState = {
    id: string;
    editor: vscode.TextEditor;
    documentUri: vscode.Uri;
    // Offsets relative to the document content at the moment the rewrite started
    startOffset: number; // start of the selection (stable anchor)
    appliedLength: number; // how many characters of rewritten text have been inserted so far
    originalText: string; // for rollbacks
    // Buffering for streaming chunks to avoid issuing too many edits
    pendingBuffer: string;
    flushScheduled: boolean;
    flushing: boolean;
    // Whether the server reported finished
    finished: boolean;
    // Whether we already removed the original text and started streaming into the buffer
    started: boolean;
    // Decoration for green background on changed lines
    decoration?: vscode.TextEditorDecorationType;
    // Suppress our onDidChangeTextDocument reaction while we apply edits
    suppressDocChange: boolean;
};

class RewriteLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

    // Lenses to display per rewrite id
    private lenses: Map<string, {
        documentUri: vscode.Uri,
        startOffset: number,
        header: string,
        showActions: boolean,
    }> = new Map();

    upsert(id: string, documentUri: vscode.Uri, startOffset: number, header: string, showActions: boolean = false) {
        this.lenses.set(id, { documentUri, startOffset, header, showActions });
        this._onDidChangeCodeLenses.fire();
    }

    updateHeader(id: string, header: string) {
        const l = this.lenses.get(id);
        if (!l) return;
        l.header = header;
        this._onDidChangeCodeLenses.fire();
    }

    updateStartOffset(id: string, startOffset: number) {
        const l = this.lenses.get(id);
        if (!l) return;
        l.startOffset = startOffset;
        this._onDidChangeCodeLenses.fire();
    }

    showActions(id: string, header: string) {
        const l = this.lenses.get(id);
        if (!l) return;
        l.header = header;
        l.showActions = true;
        this._onDidChangeCodeLenses.fire();
    }

    clear(id: string) {
        if (this.lenses.delete(id)) {
            this._onDidChangeCodeLenses.fire();
        }
    }

    provideCodeLenses(document: vscode.TextDocument): vscode.ProviderResult<vscode.CodeLens[]> {
        const out: vscode.CodeLens[] = [];
        for (const [id, lens] of this.lenses.entries()) {
            if (lens.documentUri.toString() !== document.uri.toString()) continue;
            const startPos = document.positionAt(lens.startOffset);
            const lensRange = new vscode.Range(startPos.line, 0, startPos.line, 0);

            // Header lens (always shown)
            out.push(new vscode.CodeLens(lensRange, {
                command: 'eca.rewrite.noop',
                title: lens.header,
                arguments: [],
            }));

            if (lens.showActions) {
                // Accept
                out.push(new vscode.CodeLens(lensRange, {
                    command: 'eca.rewrite.accept',
                    title: 'Accept',
                    arguments: [id],
                }));

                // Reject
                out.push(new vscode.CodeLens(lensRange, {
                    command: 'eca.rewrite.reject',
                    title: 'Reject',
                    arguments: [id],
                }));
            }
        }
        return out;
    }
}

export class RewriteFeature {
    private connection?: rpc.MessageConnection;

    // active rewrites by id
    private rewrites = new Map<string, RewriteState>();

    private lensProvider = new RewriteLensProvider();

    private static readonly LAST_PROMPT_KEY = 'eca.rewrite.lastPrompt';
    private lastPrompt: string | undefined;

    constructor(private context: vscode.ExtensionContext) {
        this.lastPrompt = this.context.globalState.get<string>(RewriteFeature.LAST_PROMPT_KEY);
    }

    register(): vscode.Disposable[] {
        return [
            vscode.languages.registerCodeLensProvider({ scheme: 'file' }, this.lensProvider),
            vscode.commands.registerCommand('eca.rewrite', () => this.startRewriteFromSelection()),
            vscode.commands.registerCommand('eca.rewrite.accept', (id: string) => this.accept(id)),
            vscode.commands.registerCommand('eca.rewrite.reject', (id: string) => this.reject(id)),
            vscode.commands.registerCommand('eca.rewrite.noop', () => { /* header lens no-op */ }),
            vscode.workspace.onDidChangeTextDocument((e) => this.onDocumentChanged(e)),
        ];
    }

    attach(connection: rpc.MessageConnection) {
        this.connection = connection;
        connection.onNotification(ecaApi.rewriteContentReceived, (params: protocol.RewriteContentReceivedParams) => {
            this.onContent(params);
        });
    }

    private async startRewriteFromSelection() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }
        if (!this.connection) {
            vscode.window.showErrorMessage('ECA server is not running yet. Please wait until it starts.');
            return;
        }
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Select a range to rewrite.');
            return;
        }

        const config = vscode.workspace.getConfiguration('eca');
        const prefix = config.get<string>('rewrite.promptPrefix') ?? '';
        const prompt = await vscode.window.showInputBox({
            title: 'Rewrite prompt',
            placeHolder: 'Describe how to rewrite the selected text…',
            value: this.lastPrompt ?? prefix,
        });
        if (prompt === undefined) return; // cancelled

        this.lastPrompt = prompt;
        void this.context.globalState.update(RewriteFeature.LAST_PROMPT_KEY, prompt);

        const fullPrompt = `${prefix}${prompt}`;
        await this.startRewrite(editor, selection, fullPrompt);
    }

    private async startRewrite(editor: vscode.TextEditor, range: vscode.Range, prompt: string) {
        const document = editor.document;
        const originalText = document.getText(range);
        const id = util.randUuid();

        // Create state entry
        const startOffset = document.offsetAt(range.start);
        const state: RewriteState = {
            id,
            editor,
            documentUri: document.uri,
            startOffset,
            appliedLength: 0,
            originalText,
            pendingBuffer: '',
            flushScheduled: false,
            flushing: false,
            finished: false,
            started: false,
            decoration: undefined,
            suppressDocChange: false,
        };
        this.rewrites.set(id, state);

        // Send prompt to server (fire and forget)
        const params: protocol.RewritePromptParams = {
            id,
            text: originalText,
            prompt,
            path: document.uri.fsPath,
            range: {
                start: { line: range.start.line + 1, character: range.start.character },
                end: { line: range.end.line + 1, character: range.end.character },
            }
        };
        // Show header lens while we wait for server
        this.lensProvider.upsert(id, document.uri, startOffset, `$(sync~spin)  Requesting LLM`, false);

        // Best-effort; let server stream responses; do not block UI
        this.connection?.sendRequest(ecaApi.rewritePrompt, params).catch(err => {
            console.error('rewrite/prompt failed', err);
            vscode.window.showErrorMessage('Rewrite failed to start');
            this.lensProvider.clear(id);
            this.rewrites.delete(id);
        });

        // Do not remove original text yet; wait for 'started' to arrive.
    }

    private onContent(params: protocol.RewriteContentReceivedParams) {
        const state = this.rewrites.get(params.rewriteId);
        if (!state) return; // Could be stale if user cancelled

        const content = params.content;
        switch (content.type) {
            case 'reasoning': {
                const spinner = '$(sync~spin) ';
                this.lensProvider.updateHeader(state.id, `${spinner} LLM reasoning`);
                return;
            }
            case 'started':
                this.beginStreaming(state).then(() => {
                    if (state.pendingBuffer) this.scheduleFlush(state);
                });
                return;
            case 'text':
                this.enqueueText(state, content.text);
                // If we've already started, flush soon; otherwise keep buffering
                if (state.started) this.scheduleFlush(state);
                return;
            case 'finished':
                state.finished = true;
                // Ensure we've started (server should send 'started' first but be defensive)
                this.beginStreaming(state).finally(() => {
                    this.flush(state).finally(() => {
                        this.lensProvider.showActions(
                            state.id,
                            'Rewrite'
                        );
                    });
                });
                return;
        }
    }

    private enqueueText(state: RewriteState, text: string) {
        state.pendingBuffer += text;
    }

    private scheduleFlush(state: RewriteState) {
        if (!state.started) return;
        if (!state.flushScheduled) {
            state.flushScheduled = true;
            setTimeout(() => void this.flush(state), 10);
        }
    }

    private async flush(state: RewriteState) {
        if (!state.started) { state.flushScheduled = false; return; }
        if (state.flushing) return; // serialized
        const toInsert = state.pendingBuffer;
        if (!toInsert) { state.flushScheduled = false; return; }
        state.pendingBuffer = '';
        state.flushing = true;
        state.suppressDocChange = true;
        try {
            const editor = state.editor;
            const document = editor.document;
            // Compute insertion point at the end of the currently applied text
            const insertPos = document.positionAt(state.startOffset + state.appliedLength);
            const ok = await editor.edit((edit) => {
                edit.insert(insertPos, toInsert);
            }, { undoStopBefore: false, undoStopAfter: false });
            if (ok) {
                state.appliedLength += toInsert.length;
            } else {
                // If the incremental edit failed (rare), try a replace of the whole region
                const newEnd = document.positionAt(state.startOffset + state.appliedLength);
                const replaceRange = new vscode.Range(document.positionAt(state.startOffset), newEnd);
                const fullTextSoFar = document.getText(replaceRange) + toInsert;
                const ok2 = await editor.edit((edit) => {
                    edit.replace(replaceRange, fullTextSoFar);
                }, { undoStopBefore: false, undoStopAfter: false });
                if (ok2) {
                    state.appliedLength = fullTextSoFar.length;
                }
            }
            // Update highlight after any successful change or replacement
            this.updateDecoration(state);
        } finally {
            state.flushing = false;
            // Defer un-suppress to the next tick to let VSCode fire change events for our edit
        setTimeout(() => { state.suppressDocChange = false; }, 0);
            // If more text came in while we were flushing, schedule again
            if (state.pendingBuffer) {
                state.flushScheduled = true;
                setTimeout(() => void this.flush(state), 10);
            } else {
                state.flushScheduled = false;
            }
        }
    }

    private async beginStreaming(state: RewriteState) {
        if (state.started) return;
        const editor = this.ensureOpenEditor(state);
        if (!editor) {
            // If the editor is gone, cancel this rewrite
            this.rewrites.delete(state.id);
            return;
        }
        const document = editor.document;
        let begin = document.positionAt(state.startOffset);
        let end = document.positionAt(state.startOffset + state.originalText.length);
        let targetRange = new vscode.Range(begin, end);
        state.suppressDocChange = true;
        let ok = await editor.edit((edit) => {
            edit.replace(targetRange, '');
        }, { undoStopBefore: true, undoStopAfter: false });

        if (!ok) {
            // Fallback: locate the original text in the current document
            const full = document.getText();
            const idx = full.indexOf(state.originalText);
            if (idx >= 0) {
                begin = document.positionAt(idx);
                end = document.positionAt(idx + state.originalText.length);
                targetRange = new vscode.Range(begin, end);
                ok = await editor.edit((edit) => {
                    edit.replace(targetRange, '');
                }, { undoStopBefore: true, undoStopAfter: false });
                if (ok) {
                    state.startOffset = idx;
                    // also update lens position if it exists
                    this.lensProvider.updateStartOffset(state.id, idx);
                }
            }
        }
        // Defer un-suppress to the next tick to let VSCode fire change events for our edit
        setTimeout(() => { state.suppressDocChange = false; }, 0);

        if (ok) {
            state.started = true;
            // Create a theme-aware decoration for this rewrite
            state.decoration = vscode.window.createTextEditorDecorationType({
                isWholeLine: true,
                backgroundColor: new vscode.ThemeColor('diffEditor.insertedTextBackground'),
                overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.addedForeground'),
                overviewRulerLane: vscode.OverviewRulerLane.Right,
            });
            // Initialize with empty range (will update on first flush)
            editor.setDecorations(state.decoration, []);
        } else {
            vscode.window.showWarningMessage('ECA: could not start streaming rewrite (document was modified).');
            this.rewrites.delete(state.id);
            this.lensProvider.clear(state.id);
        }
    }

    private ensureOpenEditor(state: RewriteState): vscode.TextEditor | undefined {
        // Prefer the original editor if still open
        if (state.editor && !state.editor.document.isClosed) { return state.editor; }
        // Fallback: find any visible editor for the target document
        for (const ed of vscode.window.visibleTextEditors) {
            if (ed.document.uri.toString() === state.documentUri.toString()) { return ed; }
        }
        return undefined;
    }

    private updateDecoration(state: RewriteState) {
        if (!state.started || !state.decoration) { return; }
        const editor = this.ensureOpenEditor(state);
        if (!editor) { return; }
        if (state.appliedLength <= 0) {
            editor.setDecorations(state.decoration, []);
            return;
        }
        const doc = editor.document;
        const startPos = doc.positionAt(state.startOffset);
        const endPos = doc.positionAt(state.startOffset + state.appliedLength);
        const startLine = startPos.line;
        const endLine = endPos.line;
        const range = new vscode.Range(
            new vscode.Position(startLine, 0),
            doc.lineAt(endLine).range.end
        );
        editor.setDecorations(state.decoration, [range]);
    }

    private onDocumentChanged(e: vscode.TextDocumentChangeEvent) {
        // Clean visuals if user changed the document containing an active rewrite
        if (e.contentChanges.length === 0) { return; }
        for (const state of Array.from(this.rewrites.values())) {
            if (state.documentUri.toString() !== e.document.uri.toString()) { continue; }
            if (state.suppressDocChange) { continue; }

            // Determine the current rewrite region in this document version
            const doc = e.document;
            const regionStart = state.startOffset;
            const regionLength = state.started ? state.appliedLength : state.originalText.length;
            const regionEnd = regionStart + regionLength;

            // If any change intersects the region, clean up visuals
            const intersects = e.contentChanges.some((ch) => {
                const cs = doc.offsetAt(ch.range.start);
                const ce = doc.offsetAt(ch.range.end);
                return !(ce <= regionStart || cs >= regionEnd);
            });

            if (!intersects) { continue; }

            const editor = this.ensureOpenEditor(state);
            if (editor && state.decoration) {
                editor.setDecorations(state.decoration, []);
                state.decoration.dispose();
            }
            this.lensProvider.clear(state.id);
            this.rewrites.delete(state.id);
        }
    }

    private async accept(id: string) {
        const state = this.rewrites.get(id);
        if (!state) return;
        this.lensProvider.clear(id);
        const editor = this.ensureOpenEditor(state);
        if (editor && state.decoration) {
            editor.setDecorations(state.decoration, []);
            state.decoration.dispose();
            state.decoration = undefined;
        }
        // Keep the applied changes; just make the undo stop after accept
        if (editor) {
            await editor.edit(() => { /* no-op edit to create an undo stop */ }, { undoStopBefore: false, undoStopAfter: true });
        }
        this.rewrites.delete(id);
    }

    private async reject(id: string) {
        const state = this.rewrites.get(id);
        if (!state) return;

        const editor = this.ensureOpenEditor(state);
        if (!editor) {
            this.lensProvider.clear(id);
            this.rewrites.delete(id);
            return;
        }

        await this.flush(state);

        const document = editor.document;
        const begin = document.positionAt(state.startOffset);
        const end = document.positionAt(state.startOffset + state.appliedLength);
        const replaceRange = new vscode.Range(begin, end);

        // Remove highlight before restoring
        if (state.decoration) {
            editor.setDecorations(state.decoration, []);
            state.decoration.dispose();
            state.decoration = undefined;
        }

        state.suppressDocChange = true;
        await editor.edit((edit) => {
            edit.replace(replaceRange, state.originalText);
        }, { undoStopBefore: false, undoStopAfter: true });
        // Defer un-suppress to the next tick to let VSCode fire change events for our edit
        setTimeout(() => { state.suppressDocChange = false; }, 0);

        this.lensProvider.clear(id);
        this.rewrites.delete(id);
    }
}
