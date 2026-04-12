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
export const chatPromptSteer = new rpc.NotificationType<p.ChatPromptSteerParams>('chat/promptSteer');
export const chatDelete = new rpc.RequestType<p.ChatDeleteParams, {}, void>('chat/delete');
export const chatRollback = new rpc.RequestType<p.ChatRollbackParams, {}, void>('chat/rollback');
export const chatAddFlag = new rpc.RequestType<p.ChatAddFlagParams, {}, void>('chat/addFlag');
export const chatRemoveFlag = new rpc.RequestType<p.ChatRemoveFlagParams, {}, void>('chat/removeFlag');
export const chatFork = new rpc.RequestType<p.ChatForkParams, {}, void>('chat/fork');
export const chatCleared = new rpc.NotificationType<p.ChatClearedParams>('chat/cleared');
export const chatDeleted = new rpc.NotificationType<p.ChatDeletedParams>('chat/deleted');
export const chatOpened = new rpc.NotificationType<p.ChatOpenedParams>('chat/opened');
export const chatStatusChanged = new rpc.NotificationType<p.ChatStatusChangedParams>('chat/statusChanged');
export const chatContentReceived = new rpc.NotificationType<p.ChatContentReceivedParams>('chat/contentReceived');
export const chatQueryContext = new rpc.RequestType<p.ChatQueryContextParams, p.ChatQueryContextResponse, void>('chat/queryContext');
export const chatQueryCommands = new rpc.RequestType<p.ChatQueryCommandsParams, p.ChatQueryCommandsResponse, void>('chat/queryCommands');
export const chatQueryFiles = new rpc.RequestType<p.ChatQueryFilesParams, p.ChatQueryFilesResponse, void>('chat/queryFiles');
export const toolServerUpdated = new rpc.NotificationType<p.ToolServerUpdatedParams>('tool/serverUpdated');
export const configUpdated = new rpc.NotificationType<p.ConfigUpdatedParams>('config/updated');
export const chatSelectedModelChanged = new rpc.NotificationType<p.ChatSelectedModelChangedParams>('chat/selectedModelChanged');
export const chatSelectedAgentChanged = new rpc.NotificationType<p.ChatSelectedAgentChangedParams>('chat/selectedAgentChanged');
export const mcpStartServer = new rpc.NotificationType<p.McpStartServerParams>('mcp/startServer');
export const mcpStopServer = new rpc.NotificationType<p.McpStopServerParams>('mcp/stopServer');
export const mcpConnectServer = new rpc.NotificationType<p.McpConnectServerParams>('mcp/connectServer');
export const mcpLogoutServer = new rpc.NotificationType<p.McpLogoutServerParams>('mcp/logoutServer');
export const mcpDisableServer = new rpc.NotificationType<p.McpDisableServerParams>('mcp/disableServer');
export const mcpEnableServer = new rpc.NotificationType<p.McpEnableServerParams>('mcp/enableServer');
export const mcpUpdateServer = new rpc.RequestType<p.McpUpdateServerParams, object, void>('mcp/updateServer');

// Providers
export const providersList = new rpc.RequestType<{ requestId?: string }, any, void>('providers/list');
export const providersLogin = new rpc.RequestType<{ provider: string; method?: string; requestId?: string }, any, void>('providers/login');
export const providersLoginInput = new rpc.RequestType<{ provider: string; data: Record<string, string>; requestId?: string }, any, void>('providers/loginInput');
export const providersLogout = new rpc.RequestType<{ provider: string; requestId?: string }, any, void>('providers/logout');
export const providersUpdated = new rpc.NotificationType<any>('providers/updated');

// Editor
export const editorGetDiagnostics = new rpc.RequestType<p.EditorGetDiagnosticsParams, p.EditorGetDiagnosticsResult, void>('editor/getDiagnostics');

// Rewrite
export const rewritePrompt = new rpc.RequestType<p.RewritePromptParams, p.RewritePromptResponse, void>('rewrite/prompt');
export const rewriteContentReceived = new rpc.NotificationType<p.RewriteContentReceivedParams>('rewrite/contentReceived');

// Background Jobs
export const jobsUpdated = new rpc.NotificationType<p.JobsUpdatedParams>('jobs/updated');
export const jobsList = new rpc.RequestType<{}, p.JobsListResult, void>('jobs/list');
export const jobsReadOutput = new rpc.RequestType<p.JobsReadOutputParams, p.JobsReadOutputResult, void>('jobs/readOutput');
export const jobsKill = new rpc.RequestType<p.JobsKillParams, p.JobsKillResult, void>('jobs/kill');
