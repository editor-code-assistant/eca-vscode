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

export interface InitializeResult {}

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
export type ChatBehavior = 'agent' | 'chat';

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

export interface ChatDeleteParams {
    chatId: string;
}

export interface ChatContentReceivedParams {}

export type ChatContentRole = 'user' | 'system' | 'assistant';

export interface ToolCallOutput {
    type: 'text';
    text: string;
}

export type ToolCallOrigin = 'mcp' | 'native';

export type ToolCallDetails = FileChangeDetails;

export interface FileChangeDetails {
    type: 'fileChange';
    path: string;
    diff: string;
    linesAdded: number;
    linesRemoved: number;
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
        behaviors?: string[];
        selectModel?: string;
        selectBehavior?: ChatBehavior;
        welcomeMessage?: string;
    }
}

export type ToolServerStatus = 'running' | 'starting' | 'stopped' | 'failed' | 'disabled';

interface MCPServerUpdatedParams {
    type: 'mcp';
    name: string;
    command: string;
    args: string[];
    status: ToolServerStatus;
    tools?: ServerTool[];
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
