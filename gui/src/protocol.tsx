export interface WorkspaceFolder {
    name: string;
    uri: string;
}

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
    arguments: { [key: string]: string };
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
    arguments: { [key: string]: string };
    error: boolean;
    outputs: ToolCallOutput[];
}

export interface ToolCallOutput {
    type: 'text';
    content: string;
}

export type ToolCallOrigin = 'mcp' | 'native';

interface ReasonStartedContent {
    type: 'reasonStarted';
    id: string;
}

interface ReasonTextContent {
    type: 'reasonText';
    id: string;
    text: string;
}

interface ReasonFinishedContent {
    type: 'reasonFinished';
    id: string;
}

type ChatContent = { type: string } & (
    TextContent
    | URLContent
    | ProgressContent
    | UsageContent
    | ToolCallPrepareContent
    | ToolCallRunContent
    | ToolCallRejectedContent
    | ToolCalledContent
    | ReasonStartedContent
    | ReasonTextContent
    | ReasonFinishedContent);

export type ChatContentRole = 'user' | 'system' | 'assistant';

export interface ChatContentReceived {
    chatId: string,
    role: ChatContentRole,
    content: ChatContent,
}

type ToolServerStatus = 'running' | 'starting' | 'stopped' | 'failed' | 'disabled';

interface MCPServerUpdatedParams {
    type: 'mcp';
    name: string;
    command: string;
    args: string[];
    status: ToolServerStatus;
    tools?: ServerTool[];
}

export interface EcaServerUpdatedParams {
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

interface FileContext {
    type: 'file';
    path: string;
    linesRange: {
        start: number;
        end: number;
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

export type ChatContext = FileContext | DirectoryContext | WebContext | RepoMapContext;

export interface ChatQueryContextResult {
    chatId?: string,
    contexts: ChatContext[],
}

export interface ChatQueryCommandsResult {
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
