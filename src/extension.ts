import * as vscode from 'vscode';
import * as commands from './commands';
import * as ecaApi from './ecaApi';
import * as protocol from './protocol';
import { EcaServer, EcaServerPathFinder } from './server';
import * as s from './session';
import * as statusbar from './status-bar';
import { EcaWebviewProvider } from './webview';
import { RewriteFeature } from './rewrite';

async function activate(context: vscode.ExtensionContext) {

	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	statusBar.command = 'eca.manage';
	statusBar.show();
	const ecaChannel = vscode.window.createOutputChannel('ECA stderr', 'Clojure');

	const webviewProvider = new EcaWebviewProvider(context, ecaChannel);
	const serverPathFinder = new EcaServerPathFinder(context, ecaChannel);

	const rewrite = new RewriteFeature(context);
	const rewriteDisposables = rewrite.register();

	const server = new EcaServer({
		serverPathFinder: serverPathFinder,
		channel: ecaChannel,
		onStarted: (connection) => {
			const session = s.getSession()!;
			connection.onNotification(ecaApi.chatContentReceived, (params: protocol.ChatContentReceivedParams) => {
				webviewProvider.chatContentReceived(params);
			});

			connection.onNotification(ecaApi.chatCleared, (params: protocol.ChatClearedParams) => {
				webviewProvider.chatCleared(params);
			});

			connection.onNotification(ecaApi.chatDeleted, (params: protocol.ChatDeletedParams) => {
				webviewProvider.chatDeleted(params);
			});

			connection.onNotification(ecaApi.chatOpened, (params: protocol.ChatOpenedParams) => {
				webviewProvider.chatOpened(params);
			});

			connection.onNotification(ecaApi.chatStatusChanged, (params: protocol.ChatStatusChangedParams) => {
				webviewProvider.chatStatusChanged(params);
			});

			connection.onNotification(ecaApi.toolServerUpdated, (params: protocol.ToolServerUpdatedParams) => {
				webviewProvider.toolServerUpdated(params);
			});

			connection.onNotification(ecaApi.configUpdated, (params: protocol.ConfigUpdatedParams) => {
				webviewProvider.configUpdated(params);
			});

			connection.onRequest(ecaApi.editorGetDiagnostics, (params: protocol.EditorGetDiagnosticsParams): protocol.EditorGetDiagnosticsResult => {
				const severityMap: Record<number, string> = {
					[vscode.DiagnosticSeverity.Error]: 'error',
					[vscode.DiagnosticSeverity.Warning]: 'warning',
					[vscode.DiagnosticSeverity.Information]: 'info',
					[vscode.DiagnosticSeverity.Hint]: 'hint',
				};

				function mapDiagnostics(uri: vscode.Uri, diagnostics: vscode.Diagnostic[]): protocol.EditorDiagnostic[] {
					return diagnostics.map(d => ({
						uri: uri.toString(),
						severity: severityMap[d.severity] ?? 'unknown',
						code: d.code != null ? (typeof d.code === 'object' ? String(d.code.value) : String(d.code)) : null,
						range: {
							start: { line: d.range.start.line, character: d.range.start.character },
							end: { line: d.range.end.line, character: d.range.end.character },
						},
						source: d.source ?? null,
						message: d.message,
					}));
				}

				if (params.uri) {
					const uri = vscode.Uri.parse(params.uri);
					const diagnostics = vscode.languages.getDiagnostics(uri);
					return { diagnostics: mapDiagnostics(uri, diagnostics) };
				} else {
					const all = vscode.languages.getDiagnostics();
					const diagnostics = all.flatMap(([uri, diags]) => mapDiagnostics(uri, diags));
					return { diagnostics };
				}
			});

			rewrite.attach(connection);

			webviewProvider.sessionChanged(session);
			webviewProvider.focus();
		},
		onStatusChanged: (status) => {
			statusbar.update(statusBar, status);
			webviewProvider.handleNewStatus(status);
		}
	});

	let workspaceFolders = vscode.workspace.workspaceFolders?.map(f => {
		return {
			name: f.name,
			uri: f.uri.toString()
		};
	}) || [];

	s.initSession(server, workspaceFolders);

	server.start();

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(webviewProvider.providerId, webviewProvider, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
		...commands.registerVSCodeCommands({
			server: server,
			webviewProvider: webviewProvider,
			context: context,
		}),
		...rewriteDisposables,
		vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
			if (e.affectsConfiguration('eca')) {
				webviewProvider.configUpdated(undefined);
			}
		}),
		vscode.window.onDidChangeTextEditorSelection((e) => {
			if (e.textEditor !== vscode.window.activeTextEditor) return;
			webviewProvider.onFileFocused(e.textEditor);
		})
	);
}

async function deactivate() {
	let session = s.getSession();
	if (session) {
		await session.server.stop();
	}
}

export { activate, deactivate };
