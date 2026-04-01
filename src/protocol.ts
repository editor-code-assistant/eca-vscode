export interface InitializeParams {
    processId: number;
    clientInfo: {
        name: string;
        version: string;
    };
    capabilities: {
        codeAssistant: {
            chat: boolean;
            rewrite?: boolean;
            editor?: {
                diagnostics?: boolean;
            }
        };
    };
    initializationOptions?: any;
    workspaceFolders: WorkspaceFolder[];
}

export interface WorkspaceFolder {
    name: string;
    uri: string;
}

export interface InitializeResult {}

export type ChatAgent = string;

export interface Position {
    line: number;
    character: number;
}

export interface Range {
    start: Position;
    end: Position;
}

export interface ChatPromptParams {
    chatId?: string;
    requestId: string;
    message: string;
    model?: string;
    agent?: ChatAgent;
    variant?: string;
    trust?: boolean;
    contexts?: ChatContext[];
}

export interface ChatSelectedModelChangedParams {
    model: string;
    variant?: string;
}

export interface ChatSelectedAgentChangedParams {
    agent: ChatAgent;
}

interface FileContext {
    type: 'file';
    path: string;
    linesRange?: {
        start: number,
        end: number,
    }
}

interface DirectoryContext {
    type: 'directory';
    path: string;
}

interface WebContext {
    type: 'web';
    url: string;
}

interface RepoMapContext {
    type: 'repoMap';
}

interface McpResourceContext {
    type: 'mcpResource';
    uri: string;
    name: string;
    description: string;
    mimeType: string;
    server: string;
}

export type ChatContext = FileContext | DirectoryContext | WebContext | RepoMapContext | McpResourceContext;

export interface ChatPromptResult {
    chatId: string;
    model: string;
}

export interface ChatToolCallApproveParams {
    chatId: string;
    toolCallId: string;
    save?: string;
}

export interface ChatToolCallRejectParams {
    chatId: string;
    toolCallId: string;
}

export interface ChatPromptStopParams {
    chatId: string;
}

export interface ChatPromptSteerParams {
    chatId: string;
    message: string;
}

export interface ChatDeleteParams {
    chatId: string;
}

export interface ChatClearedParams {
    chatId: string;
    messages: boolean;
}

export interface ChatRollbackParams {
    chatId: string;
    contentId: string;
    include: string[];
}

export interface ChatDeletedParams {
    chatId: string;
}

export interface ChatOpenedParams {
    chatId: string;
    title?: string;
}

export interface ChatStatusChangedParams {
    chatId: string;
    status: string;
}

export interface ChatContentReceivedParams {}

export type ChatContentRole = 'user' | 'system' | 'assistant';

export interface ToolCallOutput {
    type: 'text';
    text: string;
}

export type ToolCallOrigin = 'mcp' | 'native';

export type ToolCallDetails = FileChangeDetails | JsonOutputsDetails;

export interface FileChangeDetails {
    type: 'fileChange';
    path: string;
    diff: string;
    linesAdded: number;
    linesRemoved: number;
}

interface JsonOutputsDetails {
    type: 'jsonOutputs';
    jsons: string[];
}

export interface ChatQueryContextParams {
    chatId: string;
    query: string;
    contexts: ChatContext[];
}

export interface ChatQueryContextResponse {
    chatId: string;
    contexts: ChatContext[];
}

export interface ChatQueryCommandsParams {
    chatId: string;
    query: string;
}

export interface ChatQueryCommandsResponse {
    chatId: string;
    contexts: ChatCommand[];
}

export interface ChatQueryFilesParams {
    chatId: string;
    query: string;
}

export interface ChatFile {
    path: string;
}

export interface ChatQueryFilesResponse {
    chatId: string;
    files: ChatFile[];
}

export interface ChatCommand {
    name: string;
    description: string;
    type: 'mcpPrompt' | 'native';
    arguments: [{
        name: string;
        description?: string;
        required: boolean;
    }];
}

export interface ConfigUpdatedParams {
    chat?: {
        models?: string[];
        agents?: ChatAgent[];
        selectModel?: string;
        selectAgent?: ChatAgent;
        welcomeMessage?: string;
        variants?: string[];
        selectVariant?: string | null;
    }
}

export type ToolServerStatus = 'running' | 'starting' | 'stopped' | 'failed' | 'disabled' | 'requires-auth';

interface MCPServerUpdatedParams {
    type: 'mcp';
    name: string;
    command: string;
    args: string[];
    status: ToolServerStatus;
    tools?: ServerTool[];
    hasAuth?: boolean;
}

interface EcaServerUpdatedParams {
    type: 'native';
    name: string;
    status: ToolServerStatus;
    tools: ServerTool[];
}

export type ToolServerUpdatedParams = EcaServerUpdatedParams | MCPServerUpdatedParams;

export interface ServerToolParameters {
    properties: { [key: string]: { type: string, description?: string } },
    required: string[],
}

export interface ServerTool {
    name: string;
    description: string;
    parameters: ServerToolParameters;
    disabled?: boolean;
}

export interface McpStartServerParams {
    name: string;
}

export interface McpStopServerParams {
    name: string;
}

export interface McpConnectServerParams {
    name: string;
}

export interface McpLogoutServerParams {
    name: string;
}

export interface McpDisableServerParams {
    name: string;
}

export interface McpEnableServerParams {
    name: string;
}

export interface McpUpdateServerParams {
    name: string;
    command?: string;
    args?: string[];
    url?: string;
}

// === Editor Diagnostics ===

export interface EditorGetDiagnosticsParams {
    uri?: string;
}

export interface EditorDiagnostic {
    uri: string;
    severity: string;
    code: string | null;
    range: Range;
    source: string | null;
    message: string;
}

export interface EditorGetDiagnosticsResult {
    diagnostics: EditorDiagnostic[];
}

// === Rewrite ===

export interface RewritePromptParams {
    id: string;
    text: string;
    prompt: string;
    path?: string;
    range: Range;
}

export interface RewritePromptResponse {
    status: 'prompting';
    model: string;
}

export type RewriteContent =
    | { type: 'started' }
    | { type: 'reasoning' }
    | { type: 'text'; text: string }
    | { type: 'error'; message: string }
    | { type: 'finished'; totalTimeMs?: number };

export interface RewriteContentReceivedParams {
    rewriteId: string;
    content: RewriteContent;
}
