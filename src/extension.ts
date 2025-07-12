import * as cp from 'child_process';
import * as vscode from 'vscode';
import * as rpc from 'vscode-jsonrpc/node';
import * as chat from './chat';
import { ChatProvider } from './chat';
import * as protocol from './protocol';
import * as s from './session';
import * as status_bar from './status-bar';
import { EcaStatus } from './status-bar';

async function activate(context: vscode.ExtensionContext) {

	const chatProvider = new ChatProvider(context);

	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	statusBar.command = 'eca.manage';
	status_bar.update(statusBar, EcaStatus.Stopped);
	statusBar.show();

	const disposable = vscode.commands.registerCommand('eca.start', () => {
		status_bar.update(statusBar, EcaStatus.Starting);
		const ecaChannel = vscode.window.createOutputChannel('ECA stderr', 'Clojure');

		let ecaProcess = cp.spawn('/home/greg/dev/eca/eca', ['server']);

		ecaProcess.stderr.on('data', (data) => {
			ecaChannel.appendLine(data.toString());
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

		let connection = rpc.createMessageConnection(
			new rpc.StreamMessageReader(ecaProcess.stdout),
			new rpc.StreamMessageWriter(ecaProcess.stdin));

		s.initSession(ecaProcess, workspaceFolders, connection);

		connection.listen();

		connection.sendRequest(protocol.initialize, {
			processId: process.pid,
			clientInfo: {
				name: "VsCode",
				version: 'XXX'
			},
			capabilities: {
				codeAssistant: {
					chat: true
				}
			},
			initializationOptions: {
				// TODO custom setting chatBehavior
			},
			workspaceFolders: workspaceFolders,
		}).then((result) => {
			let session = s.getSession()!;
			session.models = result.models;
			session.chatWelcomeMessage = result.chatWelcomeMessage;
			session.chatBehavior = result.chatBehavior;
			session.status = 'started';
			status_bar.update(statusBar, EcaStatus.Running);
			chat.focusChat();
		});

		connection.onNotification(protocol.chatContentReceived, (params) => {
			chatProvider.contentReceived(params);
		})
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(chatProvider.id, chatProvider, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
		vscode.commands.registerCommand('eca.manage', () => {
			// TODO
		}),
	);


}

async function deactivate() {
	let session = s.getSession();
	if (session?.connection) {
		await session.connection.sendRequest(protocol.shutdown, {});
	}
}

export { activate, deactivate };
