import * as rpc from 'vscode-jsonrpc/node';

export interface InitializeParams {
    processId: number;
    clientInfo: {
        name: string;
        version: string;
    };
    capabilities: {
        codeAssistant: {
            chat: boolean;
        };
    };
    initializationOptions?: any;
    workspaceFolders: WorkspaceFolder[];
}

export interface WorkspaceFolder {
    name: string;
    uri: string;
}

export interface InitializeResult {
    models: string[];
    chatDefaultModel: string;
    chatBehaviors: string[];
    chatDefaultBehavior: ChatBehavior;
    chatWelcomeMessage: string;
}

export const initialize = new rpc.RequestType<InitializeParams, InitializeResult, void>('initialize');

export const shutdown = new rpc.RequestType<any, void, void>('shutdown');

export const exit = new rpc.NotificationType<any>('exit');

export interface ChatPromptParams {
    chatId?: string;
    requestId: string;
    message: string;
    model?: string;
    behavior?: ChatBehavior;
    contexts?: ChatContext[];
}

interface FileContext {
    type: 'file';
    path: string;
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

type ChatContext = FileContext | DirectoryContext | WebContext | RepoMapContext;
export type ChatBehavior = 'agent' | 'chat';

export interface ChatPromptResult {
    chatId: string;
    model: string;
}

export const chatPrompt = new rpc.RequestType<ChatPromptParams, ChatPromptResult, void>('chat/prompt');

export interface ChatToolCallApproveParams {
    chatId: string;
    toolCallId: string;
}

export const chatToolCallApprove = new rpc.NotificationType<ChatToolCallApproveParams>('chat/toolCallApprove');

export interface ChatToolCallRejectParams {
    chatId: string;
    toolCallId: string;
}

export const chatToolCallReject = new rpc.NotificationType<ChatToolCallRejectParams>('chat/toolCallReject');

export interface ChatPromptStopParams {
    chatId: string;
}

export const chatPromptStop = new rpc.NotificationType<ChatPromptStopParams>('chat/promptStop');

interface ChatDeleteParams {
    chatId: string;
}

export const chatDelete = new rpc.RequestType<ChatDeleteParams, {}, void>('chat/delete');

export interface ChatContentReceivedParams {
    chatId: string;
    role: ChatContentRole;
    content: ChatContent;
}

type ChatContentRole = 'user' | 'system' | 'assistant';

type ChatContent =
    | TextContent
    | URLContent
    | ProgressContent
    | UsageContent
    | ToolCallPrepareContent
    | ToolCallRunContent
    | ToolCallRejectedContent
    | ToolCalledContent;

interface TextContent {
    type: 'text';
    text: string;
}

interface URLContent {
    type: 'url';
    title: string;
    url: string;
}

interface ProgressContent {
    type: 'progress';
    state: 'running' | 'finished';
    text?: string;
}

interface UsageContent {
    type: 'usage';
    messageInputTokens: number;
    messageOutputTokens: number;
    sessionTokens: number;
    messageCost?: string;
    sessionCost?: string;
}

interface ToolCallPrepareContent {
    type: 'toolCallPrepare';
    origin: ToolCallOrigin;
    id: string;
    name: string;
    argumentsText: string;
    manualApproval: boolean;
}

interface ToolCallRunContent {
    type: 'toolCallRun';
    origin: ToolCallOrigin;
    id: string;
    name: string;
    arguments: string[];
    manualApproval: boolean;
}

interface ToolCallRejectedContent {
    type: 'toolCallRejected';
    origin: ToolCallOrigin;
    id: string;
    name: string;
    arguments: { [key: string]: string };
}

interface ToolCalledContent {
    type: 'toolCalled';
    origin: ToolCallOrigin;
    id: string;
    name: string;
    arguments: string[];
    outputs: [{
        type: 'text';
        content: string;
        error: boolean;
    }];
}

type ToolCallOrigin = 'mcp' | 'native';

export const chatContentReceived = new rpc.NotificationType<ChatContentReceivedParams>('chat/contentReceived');

export interface ChatQueryContextParams {
    chatId: string;
    query: string;
    contexts: ChatContext[];
}

export interface ChatQueryContextResponse {
    chatId: string;
    contexts: ChatContext[];
}

export const chatQueryContext = new rpc.RequestType<ChatQueryContextParams, ChatQueryContextResponse, void>('chat/queryContext');

type MCPStatus = 'running' | 'starting' | 'stopped' | 'failed' | 'disabled';

export interface MCPServerUpdatedParams {
    name: string;
    command: string;
    args: string[];
    status: MCPStatus;
    tools?: MCPServerTool[];
}

export interface MCPServerTool {
    name: string;
    description: string;
    parameters: any;
}

export const mcpServerUpdated = new rpc.NotificationType<MCPServerUpdatedParams>('mcp/serverUpdated');
