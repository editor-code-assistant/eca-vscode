import * as vscode from 'vscode';
import * as rpc from 'vscode-jsonrpc/node';
import * as ecaApi from './ecaApi';
import * as protocol from './protocol';
import * as util from './util';
import { EcaWebviewProvider } from './webview';

// Inline chat: ask ECA from any file and stream the answer into a comment
// thread anchored at the cursor/selection, backed by a regular chat session
// via the `chat/inlinePrompt` server method. Tool calls, approvals, stop and
// follow-ups behave like any other chat; the backing chat also shows up in
// the ECA webview as a normal tab.

type InlineState = 'sending' | 'running' | 'done';

class EcaInlineComment implements vscode.Comment {
    body: vscode.MarkdownString = new vscode.MarkdownString();
    mode: vscode.CommentMode = vscode.CommentMode.Preview;
    author: vscode.CommentAuthorInformation;
    /** Shown next to the author name; used for the chat model. */
    label?: string;

    constructor() {
        this.author = {
            name: 'ECA',
            iconPath: vscode.Uri.joinPath(util.getExtensionUri(), 'assets', 'logo.png'),
        };
    }
}

// A single inline chat session: one comment thread anchored in a document,
// backed by a server-side chat created with a client-minted UUID.
type InlineSession = {
    chatId: string;
    thread: vscode.CommentThread;
    comment: EcaInlineComment;
    // Accumulated markdown of the current answer turn.
    answer: string;
    status: string;
    state: InlineState;
    // Pending manual tool call approvals: id -> summary, in arrival order.
    pendingTools: Map<string, string>;
};

export class InlineChatFeature {
    private connection?: rpc.MessageConnection;
    private controller: vscode.CommentController;

    // Sessions by chatId. One comment thread per session; a new prompt on
    // the same chat re-anchors (disposes the old thread).
    private sessions = new Map<string, InlineSession>();

    // Sticky chat per document uri: follow-up prompts in the same file
    // reuse the same inline chat until it is deleted or re-picked.
    private stickyByDoc = new Map<string, string>();

    // Chat titles from chat/opened; outlives a dismissed thread so a
    // sticky re-prompt can still describe its chat.
    private titles = new Map<string, string>();

    constructor(private webviewProvider: EcaWebviewProvider) {
        this.controller = vscode.comments.createCommentController('eca-inline', 'ECA Inline Chat');
    }

    register(): vscode.Disposable[] {
        return [
            this.controller,
            vscode.commands.registerCommand('eca.inlineChat.prompt', () => this.prompt(false)),
            vscode.commands.registerCommand('eca.inlineChat.promptSelecting', () => this.prompt(true)),
            vscode.commands.registerCommand('eca.inlineChat.reply', (thread: vscode.CommentThread) => this.reply(thread)),
            vscode.commands.registerCommand('eca.inlineChat.stop', (thread: vscode.CommentThread) => this.stop(thread)),
            vscode.commands.registerCommand('eca.inlineChat.approveAll', (arg: vscode.CommentThread | string) => this.approveAll(arg)),
            vscode.commands.registerCommand('eca.inlineChat.rejectAll', (arg: vscode.CommentThread | string) => this.rejectAll(arg)),
            vscode.commands.registerCommand('eca.inlineChat.openChat', (thread: vscode.CommentThread) => this.openChat(thread)),
            vscode.commands.registerCommand('eca.inlineChat.dismiss', (thread: vscode.CommentThread) => this.dismiss(thread)),
        ];
    }

    attach(connection: rpc.MessageConnection) {
        this.connection = connection;
    }

    // === Server notifications (fanned out from extension.ts) ===

    onContentReceived(params: protocol.ChatContentReceivedParams) {
        // Subagent contents belong to the webview rendering, not the inline answer.
        if (params.parentChatId) { return; }
        const session = this.sessions.get(params.chatId);
        if (!session) { return; }
        this.handleContent(session, params.role, params.content);
    }

    onStatusChanged(params: protocol.ChatStatusChangedParams) {
        const session = this.sessions.get(params.chatId);
        if (!session) { return; }
        if (params.status === 'running') {
            if (session.state !== 'running') {
                session.state = 'running';
                this.render(session);
            }
        } else if (params.status === 'idle' && session.state !== 'done') {
            // Safety net: mark the turn done even if the progress finished
            // content was missed (e.g. after a stop).
            this.finalize(session);
        }
    }

    onChatOpened(params: protocol.ChatOpenedParams) {
        if (params.title && this.sessions.has(params.chatId)) {
            this.titles.set(params.chatId, params.title);
        }
    }

    onAskQuestion(params: protocol.AskQuestionParams) {
        // Questions are answered in the webview chat; surface a hint on the
        // thread so the user knows the turn is waiting on them.
        const session = this.sessions.get(params.chatId);
        if (session) {
            this.setStatus(session, 'Question pending, open the chat to answer');
        }
    }

    onChatDeleted(params: protocol.ChatDeletedParams) {
        this.titles.delete(params.chatId);
        const session = this.sessions.get(params.chatId);
        if (session) {
            session.thread.dispose();
            this.sessions.delete(params.chatId);
        }
        // Clear stickiness in every document bound to the dead chat, even
        // when its thread was already dismissed, so the next prompt asks
        // for a chat again instead of reviving the dead id.
        for (const [doc, chatId] of Array.from(this.stickyByDoc.entries())) {
            if (chatId === params.chatId) {
                this.stickyByDoc.delete(doc);
            }
        }
    }

    // === Content routing (mirrors the eca-emacs inline overlay mapping) ===

    private handleContent(session: InlineSession, role: protocol.ChatContentRole, content: protocol.ChatContent) {
        switch (content.type) {
            case 'text': {
                if (role === 'user') {
                    // A user message starts a turn: reset the answer area so
                    // the thread always shows the answer to the last question.
                    this.startTurn(session);
                } else if (role === 'assistant') {
                    session.answer += content.text ?? '';
                    this.setStatus(session, 'Streaming...', 'running');
                } else if (role === 'system') {
                    // System text carries errors and notices (e.g. provider
                    // failures after the prompt started); surface it so
                    // failed turns don't render as a clean Done.
                    session.answer += content.text ?? '';
                    this.render(session);
                }
                return;
            }
            case 'progress': {
                if (content.state === 'running') {
                    // While tool calls wait for approval, keep their summaries
                    // as the status instead of the generic server progress
                    // text ("Waiting for tool call approval").
                    if (session.pendingTools.size === 0) {
                        this.setStatus(session, content.text ?? 'Running...', 'running');
                    }
                } else if (content.state === 'finished') {
                    this.finalize(session);
                }
                return;
            }
            case 'reasonStarted': {
                this.setStatus(session, 'Thinking...', 'running');
                return;
            }
            case 'reasonFinished': {
                this.setStatus(session, 'Waiting model...', 'running');
                return;
            }
            case 'toolCallPrepare': {
                this.setStatus(session, content.summary ?? `Preparing tool ${content.name}...`, 'running');
                return;
            }
            case 'toolCallRun': {
                if (content.manualApproval && content.id) {
                    this.setStatus(session, this.trackPendingTool(session, content.id, content.summary ?? `Tool ${content.name} needs approval`));
                } else {
                    this.setStatus(session, content.summary ?? `Running tool ${content.name}...`, 'running');
                }
                return;
            }
            case 'toolCallRunning': {
                // Approved (possibly from another client): no longer pending.
                if (content.id) { this.dropPendingTool(session, content.id); }
                this.setStatus(session, content.summary ?? `Running tool ${content.name}...`, 'running');
                return;
            }
            case 'toolCalled': {
                const remaining = content.id ? this.dropPendingTool(session, content.id) : undefined;
                if (remaining) {
                    this.setStatus(session, remaining);
                } else {
                    this.setStatus(session, 'Waiting model...', 'running');
                }
                return;
            }
            case 'toolCallRejected': {
                const remaining = content.id ? this.dropPendingTool(session, content.id) : undefined;
                if (remaining) {
                    this.setStatus(session, remaining);
                } else {
                    this.setStatus(session, 'Tool call rejected');
                }
                return;
            }
        }
    }

    private startTurn(session: InlineSession) {
        session.answer = '';
        this.setStatus(session, 'Waiting model...', 'running');
    }

    private finalize(session: InlineSession) {
        session.pendingTools.clear();
        this.setStatus(session, 'Done', 'done');
    }

    private trackPendingTool(session: InlineSession, id: string, summary: string): string {
        session.pendingTools.set(id, summary);
        return Array.from(session.pendingTools.values()).join(', ');
    }

    private dropPendingTool(session: InlineSession, id: string): string | undefined {
        session.pendingTools.delete(id);
        if (session.pendingTools.size === 0) { return undefined; }
        return Array.from(session.pendingTools.values()).join(', ');
    }

    // === Rendering ===

    private setStatus(session: InlineSession, status: string, state?: InlineState) {
        session.status = status;
        if (state) {
            session.state = state;
        }
        this.render(session);
    }

    private render(session: InlineSession) {
        session.thread.label = session.status;
        session.thread.contextValue = this.contextValueFor(session);
        const body = new vscode.MarkdownString(this.bodyFor(session));
        // Needed for the Approve/Reject command links while tools await
        // approval; restricted so LLM-generated markdown cannot smuggle
        // other command links in.
        body.isTrusted = { enabledCommands: ['eca.inlineChat.approveAll', 'eca.inlineChat.rejectAll'] };
        session.comment.body = body;
        // Reassigning the array is what triggers the comment re-render.
        session.thread.comments = [session.comment];
    }

    private contextValueFor(session: InlineSession): string {
        let value = 'ecaInline';
        if (session.state === 'done') {
            value += '-idle';
        } else {
            value += '-running';
        }
        if (session.pendingTools.size > 0) {
            value += '-pending';
        }
        return value;
    }

    private bodyFor(session: InlineSession): string {
        let body = session.answer;
        if (!body && session.state !== 'done') {
            body = '_…_';
        }
        if (session.pendingTools.size > 0) {
            const summaries = Array.from(session.pendingTools.values()).join(', ');
            const arg = encodeURIComponent(JSON.stringify(session.chatId));
            body += `\n\n---\n\n**Needs approval:** ${summaries}\n\n` +
                `[Approve](command:eca.inlineChat.approveAll?${arg}) · ` +
                `[Reject](command:eca.inlineChat.rejectAll?${arg})`;
        }
        return body;
    }

    // === Prompt flows ===

    private async prompt(forceSelect: boolean) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }
        if (!this.connection) {
            vscode.window.showErrorMessage('ECA server is not running yet. Please wait until it starts.');
            return;
        }
        const docKey = editor.document.uri.toString();
        if (forceSelect) {
            this.stickyByDoc.delete(docKey);
        }

        let chatId = this.stickyByDoc.get(docKey);
        let sourceChatId: string | undefined;
        let desc: string;
        let isNew = false;
        if (chatId) {
            const existing = this.sessions.get(chatId);
            if (existing && existing.state !== 'done') {
                vscode.window.showWarningMessage('ECA inline chat is busy, stop it first.');
                return;
            }
            desc = this.titles.get(chatId) ?? 'same chat';
        } else {
            const picked = await this.pickTargetChat();
            if (!picked) { return; } // cancelled
            chatId = util.randUuid();
            isNew = true;
            sourceChatId = picked.sourceChatId;
            desc = picked.desc;
        }

        // Compute anchor/contexts before the input box: typing there does
        // not move the selection, but this keeps the anchor what the user saw.
        const { range, contexts } = InlineChatFeature.anchorAndContexts(editor);
        const message = (await vscode.window.showInputBox({
            title: `ECA inline prompt (${desc})`,
            placeHolder: 'Ask, plan, build...',
        }))?.trim();
        if (!message) { return; }

        const session = this.createSession(chatId, editor.document.uri, range);
        this.stickyByDoc.set(docKey, chatId);
        this.setStatus(session, 'Waiting model...', 'sending');
        this.send(session, message, contexts, sourceChatId, isNew);
    }

    private async pickTargetChat(): Promise<{ sourceChatId?: string; desc: string } | undefined> {
        let chats: protocol.ChatSummary[] = [];
        try {
            const res = await this.connection!.sendRequest(ecaApi.chatList, { limit: 20 });
            chats = res.chats ?? [];
        } catch {
            // Older servers without chat/list: start fresh directly.
        }
        if (chats.length === 0) {
            return { desc: 'new chat' };
        }
        type Item = vscode.QuickPickItem & { chat?: protocol.ChatSummary };
        const items: Item[] = [
            { label: '$(add) New inline chat' },
            { label: 'Fork from existing chat', kind: vscode.QuickPickItemKind.Separator },
            ...chats.map((chat): Item => ({
                label: chat.title ?? chat.id,
                description: chat.kind === 'inline' ? 'inline' : undefined,
                detail: chat.updatedAt ? new Date(chat.updatedAt).toLocaleString() : undefined,
                chat,
            })),
        ];
        const choice = await vscode.window.showQuickPick(items, {
            title: 'ECA inline prompt',
            placeHolder: 'Chat for this prompt: fork an existing chat or start fresh',
        });
        if (!choice) { return undefined; }
        if (!choice.chat) { return { desc: 'new chat' }; }
        return {
            sourceChatId: choice.chat.id,
            desc: `fork of ${choice.chat.title ?? choice.chat.id}`,
        };
    }

    private async reply(thread: vscode.CommentThread) {
        const session = this.findByThread(thread);
        if (!session) {
            vscode.window.showWarningMessage('This ECA inline chat no longer exists, dismiss it and start a new one.');
            return;
        }
        if (!this.connection) {
            vscode.window.showErrorMessage('ECA server is not running yet. Please wait until it starts.');
            return;
        }
        if (session.state === 'sending' || session.state === 'running') {
            vscode.window.showWarningMessage('ECA inline chat is busy, stop it first.');
            return;
        }
        const desc = this.titles.get(session.chatId) ?? 'follow-up';
        const text = (await vscode.window.showInputBox({
            title: `ECA inline prompt (${desc})`,
            placeHolder: 'Follow-up prompt for this inline chat...',
        }))?.trim();
        if (!text) { return; }
        // Reuse the current selection of a visible editor showing this
        // document as context, like the original prompt did.
        const editor = vscode.window.visibleTextEditors.find(
            (e) => e.document.uri.toString() === thread.uri.toString());
        const contexts = editor ? InlineChatFeature.anchorAndContexts(editor).contexts : [];
        session.answer = '';
        this.setStatus(session, 'Waiting model...', 'sending');
        this.send(session, text, contexts);
    }

    private send(session: InlineSession, message: string, contexts: protocol.ChatContext[], sourceChatId?: string, createdSession = false) {
        const config = vscode.workspace.getConfiguration('eca');
        const params: protocol.ChatInlinePromptParams = {
            chatId: session.chatId,
            message,
            contexts,
        };
        if (sourceChatId) {
            params.sourceChatId = sourceChatId;
        }
        const model = config.get<string>('inlineChat.model');
        const agent = config.get<string>('inlineChat.agent');
        const variant = config.get<string>('inlineChat.variant');
        if (model) { params.model = model; }
        if (agent) { params.agent = agent; }
        if (variant) { params.variant = variant; }
        this.connection?.sendRequest(ecaApi.chatInlinePrompt, params).then((res) => {
            // Param validation failures and internal server errors come back
            // as a normal response with an error status.
            if (res?.status === 'error') {
                this.failSession(session, 'Prompt failed, check the ECA server logs', createdSession);
            } else if (res?.model) {
                session.comment.label = res.model;
                this.render(session);
            }
        }, (err) => {
            this.failSession(session, `Error: ${err?.message ?? err}`, createdSession);
        });
    }

    private failSession(session: InlineSession, statusText: string, createdSession: boolean) {
        session.pendingTools.clear();
        this.setStatus(session, statusText, 'done');
        if (createdSession) {
            // The server never created this chat: drop the session and the
            // sticky binding so the next prompt picks (and re-forks) again.
            this.sessions.delete(session.chatId);
            for (const [doc, chatId] of Array.from(this.stickyByDoc.entries())) {
                if (chatId === session.chatId) {
                    this.stickyByDoc.delete(doc);
                }
            }
            // Dead thread: hide follow-up/stop actions, keep only dismiss.
            session.thread.contextValue = 'ecaInline';
        }
    }

    // === Thread actions ===

    private stop(thread: vscode.CommentThread) {
        const session = this.findByThread(thread);
        if (!session || !this.connection) { return; }
        // Plain notify: the server ignores stops for non-running chats, so
        // this is safe even before the first statusChanged arrives.
        this.connection.sendNotification(ecaApi.chatPromptStop, { chatId: session.chatId });
        this.setStatus(session, 'Stopping...');
    }

    private approveAll(arg: vscode.CommentThread | string) {
        const session = this.sessionFromArg(arg);
        if (!session || !this.connection) { return; }
        for (const toolCallId of Array.from(session.pendingTools.keys())) {
            this.connection.sendNotification(ecaApi.chatToolCallApprove, { chatId: session.chatId, toolCallId });
        }
    }

    private rejectAll(arg: vscode.CommentThread | string) {
        const session = this.sessionFromArg(arg);
        if (!session || !this.connection) { return; }
        for (const toolCallId of Array.from(session.pendingTools.keys())) {
            this.connection.sendNotification(ecaApi.chatToolCallReject, { chatId: session.chatId, toolCallId });
        }
    }

    private openChat(thread: vscode.CommentThread) {
        const session = this.findByThread(thread);
        if (!session) { return; }
        this.webviewProvider.selectChat(session.chatId);
    }

    private dismiss(thread: vscode.CommentThread) {
        const session = this.findByThread(thread);
        thread.dispose();
        if (session) {
            // Keep the sticky binding: the chat stays reusable from the
            // same document, only the rendered thread goes away.
            this.sessions.delete(session.chatId);
        }
    }

    // === Helpers ===

    private createSession(chatId: string, uri: vscode.Uri, range: vscode.Range): InlineSession {
        const old = this.sessions.get(chatId);
        if (old) {
            // One thread per chat: a new prompt re-anchors at the cursor.
            old.thread.dispose();
        }
        // No built-in reply textarea: follow-ups go through the Follow-up
        // title action, which opens a compact input box instead.
        const thread = this.controller.createCommentThread(uri, range, []);
        thread.canReply = false;
        thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
        const session: InlineSession = {
            chatId,
            thread,
            comment: new EcaInlineComment(),
            answer: '',
            status: 'Sending prompt...',
            state: 'sending',
            pendingTools: new Map(),
        };
        this.sessions.set(chatId, session);
        this.render(session);
        return session;
    }

    private findByThread(thread: vscode.CommentThread): InlineSession | undefined {
        for (const session of this.sessions.values()) {
            if (session.thread === thread) {
                return session;
            }
        }
        return undefined;
    }

    private sessionFromArg(arg: vscode.CommentThread | string): InlineSession | undefined {
        if (typeof arg === 'string') {
            return this.sessions.get(arg);
        }
        return arg ? this.findByThread(arg) : undefined;
    }

    // Whole-line anchor range for the selection (or current line) and the
    // DWIM contexts to send: the selected lines as a file linesRange
    // (1-based, inclusive) or the whole file when there is no selection.
    private static anchorAndContexts(editor: vscode.TextEditor): { range: vscode.Range; contexts: protocol.ChatContext[] } {
        const document = editor.document;
        const selection = editor.selection;
        const startLine = selection.start.line;
        let endLine = selection.end.line;
        if (!selection.isEmpty && selection.end.character === 0 && selection.end.line > selection.start.line) {
            // A selection ending at the beginning of a line (whole-lines
            // selection) should not drag that extra line in.
            endLine = selection.end.line - 1;
        }
        const range = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
        const contexts: protocol.ChatContext[] = [];
        if (document.uri.scheme === 'file') {
            if (selection.isEmpty) {
                contexts.push({ type: 'file', path: document.uri.fsPath });
            } else {
                contexts.push({
                    type: 'file',
                    path: document.uri.fsPath,
                    linesRange: { start: startLine + 1, end: endLine + 1 },
                });
            }
        }
        return { range, contexts };
    }
}
