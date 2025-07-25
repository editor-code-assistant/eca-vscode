import * as vscode from 'vscode';
import * as commands from './commands';
import * as protocol from './protocol';
import { EcaServer, EcaServerPathFinder } from './server';
import * as s from './session';
import * as statusbar from './status-bar';
import { EcaWebviewProvider } from './webview';

async function activate(context: vscode.ExtensionContext) {

	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	statusBar.command = 'eca.manage';
	statusBar.show();
	const ecaChannel = vscode.window.createOutputChannel('ECA stderr', 'Clojure');

	const webviewProvider = new EcaWebviewProvider(context);
	const serverPathFinder = new EcaServerPathFinder(context);

	const server = new EcaServer({
		serverPathFinder: serverPathFinder,
		channel: ecaChannel,
		onStarted: (connection) => {
			const session = s.getSession()!;
			connection.onNotification(protocol.chatContentReceived, (params: protocol.ChatContentReceivedParams) => {
				webviewProvider.contentReceived(params);
			});

			connection.onNotification(protocol.toolServerUpdated, (params: protocol.ToolServerUpdatedParams) => {
				webviewProvider.toolServerUpdated(params);
			});

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
		vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
			if (e.affectsConfiguration('eca')) {
				webviewProvider.configChanged();
			}
		}),
	);
}

async function deactivate() {
	let session = s.getSession();
	if (session) {
		await session.server.stop();
	}
}

export { activate, deactivate };
