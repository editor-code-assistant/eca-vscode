import * as vscode from 'vscode';
import * as commands from './commands';
import * as ecaApi from './ecaApi';
import { initLogStore } from './log-store';
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

	// Initialize the shared LogStore BEFORE the server so the earliest
	// lifecycle messages (spawn, path-finder errors, …) are captured.
	// `context.logUri` is VS Code's stable per-extension log directory.
	const logStore = initLogStore(context.logUri?.fsPath);

	const webviewProvider = new EcaWebviewProvider(context, ecaChannel);
	const serverPathFinder = new EcaServerPathFinder(context, ecaChannel);

	// Stream every new log entry to the webview as a `logs/appended`
	// message so the Settings → Logs tab renders them live. RootWrapper
	// already listens for this type and dispatches it into the redux
	// `logs` slice.
	logStore.subscribe((entry) => {
		webviewProvider.webview?.postMessage({ type: 'logs/appended', data: entry });
	});

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

			connection.onNotification(ecaApi.providersUpdated, (params) => {
				webviewProvider.providersUpdated(params);
			});

			connection.onNotification(ecaApi.jobsUpdated, (params: protocol.JobsUpdatedParams) => {
				webviewProvider.jobsUpdated(params);
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

			connection.onRequest(ecaApi.chatAskQuestion, async (params: protocol.AskQuestionParams): Promise<protocol.AskQuestionResult> => {
				return webviewProvider.askQuestion(params);
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

	// Mirror everything the server currently writes to the OutputChannel
	// into the LogStore so the Logs tab sees the same stream. The server
	// still writes to `ecaChannel` for users who prefer VS Code's native
	// Output panel — these two sinks are complementary.
	server.onLog = (msg) => logStore.append({ source: 'server', text: msg });

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
