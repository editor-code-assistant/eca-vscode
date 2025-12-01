import * as rpc from 'vscode-jsonrpc/node';
import * as p from './protocol';

export const initialize = new rpc.RequestType<p.InitializeParams, p.InitializeResult, void>('initialize');
export const initialized = new rpc.NotificationType<any>('initialized');
export const shutdown = new rpc.RequestType<any, void, void>('shutdown');
export const exit = new rpc.NotificationType<any>('exit');
export const chatPrompt = new rpc.RequestType<p.ChatPromptParams, p.ChatPromptResult, void>('chat/prompt');
export const chatToolCallApprove = new rpc.NotificationType<p.ChatToolCallApproveParams>('chat/toolCallApprove');
export const chatToolCallReject = new rpc.NotificationType<p.ChatToolCallRejectParams>('chat/toolCallReject');
export const chatPromptStop = new rpc.NotificationType<p.ChatPromptStopParams>('chat/promptStop');
export const chatDelete = new rpc.RequestType<p.ChatDeleteParams, {}, void>('chat/delete');
export const chatRollback = new rpc.RequestType<p.ChatRollbackParams, {}, void>('chat/rollback');
export const chatCleared = new rpc.NotificationType<p.ChatClearedParams>('chat/cleared');
export const chatContentReceived = new rpc.NotificationType<p.ChatContentReceivedParams>('chat/contentReceived');
export const chatQueryContext = new rpc.RequestType<p.ChatQueryContextParams, p.ChatQueryContextResponse, void>('chat/queryContext');
export const chatQueryCommands = new rpc.RequestType<p.ChatQueryCommandsParams, p.ChatQueryCommandsResponse, void>('chat/queryCommands');
export const toolServerUpdated = new rpc.NotificationType<p.ToolServerUpdatedParams>('tool/serverUpdated');
export const configUpdated = new rpc.NotificationType<p.ConfigUpdatedParams>('config/updated');
export const mcpStartServer = new rpc.NotificationType<p.McpStartServerParams>('mcp/startServer');
export const mcpStopServer = new rpc.NotificationType<p.McpStopServerParams>('mcp/stopServer');

// Rewrite
export const rewritePrompt = new rpc.RequestType<p.RewritePromptParams, p.RewritePromptResponse, void>('rewrite/prompt');
export const rewriteContentReceived = new rpc.NotificationType<p.RewriteContentReceivedParams>('rewrite/contentReceived');
