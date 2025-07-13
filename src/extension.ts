import * as vscode from 'vscode';
import * as chat from './chat';
import { ChatProvider } from './chat';
import * as commands from './commands';
import * as protocol from './protocol';
import { EcaServer, EcaServerPathFinder } from './server';
import * as s from './session';
import * as status_bar from './status-bar';

async function activate(context: vscode.ExtensionContext) {

	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	statusBar.command = 'eca.manage';
	statusBar.show();

	const ecaChannel = vscode.window.createOutputChannel('ECA stderr', 'Clojure');

	const chatProvider = new ChatProvider(context);
	const serverPathFinder = new EcaServerPathFinder(context);

	const server = new EcaServer({
		serverPathFinder: serverPathFinder,
		channel: ecaChannel,
		onStarted: (connection) => {
			connection.onNotification(protocol.chatContentReceived, (params: protocol.ChatContentReceivedParams) => {
				chatProvider.contentReceived(params);
			});

			chat.focusChat();
		},
		onStatusChanged: (status) => {
			status_bar.update(statusBar, status);
			chatProvider.handleNewStatus(status);
		}
	});

	let workspaceFolders = vscode.workspace.workspaceFolders?.map(f => {
		return {
			name: f.name,
			uri: f.uri.path
		};
	}) ||
		vscode.workspace.rootPath
		? [{ name: 'root', uri: vscode.workspace.rootPath! }]
		: [];

	s.initSession(server, workspaceFolders);

	server.start();


	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(chatProvider.id, chatProvider, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
		...commands.registerVSCodeCommands({
			server: server,
			context: context,
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
