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

interface ToolCalledContent {
    type: 'toolCalled';
    origin: ToolCallOrigin;
    id: string;
    name: string;
    arguments: { [key: string]: string };
    outputs: ToolCallOutput[];
}

export interface ToolCallOutput {
    type: 'text';
    content: string;
    error: boolean;
}

export type ToolCallOrigin = 'mcp' | 'native';

type ChatContent = { type: string } & (TextContent | URLContent
    | ProgressContent
    | ToolCallPrepareContent
    | ToolCallRunContent
    | ToolCalledContent);

export type ChatContentRole = 'user' | 'system' | 'assistant';

export interface ChatContentReceived {
    chatId: string,
    role: ChatContentRole,
    content: ChatContent,
}

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
