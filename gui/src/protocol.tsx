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

interface ToolCallOutput {
    type: 'text';
    content: string;
    error: boolean;
}

type ToolCallOrigin = 'mcp' | 'native';

type ChatContent = { type: string } & (TextContent | URLContent
    | ProgressContent
    | ToolCallPrepareContent
    | ToolCallRunContent
    | ToolCalledContent);

type ChatContentRole = 'user' | 'system' | 'assistant';

interface ChatContentReceived {
    chatId: string,
    role: ChatContentRole,
    content: ChatContent,
}
