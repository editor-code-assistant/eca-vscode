import * as cp from 'child_process';
import * as vscode from 'vscode';
import * as rpc from 'vscode-jsonrpc/node';
import * as chat from './chat';
import { ChatProvider } from './chat';
import * as protocol from './protocol';
import * as s from './session';

export function activate(context: vscode.ExtensionContext) {

	const disposable = vscode.commands.registerCommand('eca.start', () => {
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
			let session = s.curSession()!;
			session.models = result.models;
			session.chatWelcomeMessage = result.chatWelcomeMessage;
			session.chatBehavior = result.chatBehavior;
			session.status = 'started';
			chat.focusChat();
		});
	});

	const chatProvider = new ChatProvider(context);

	context.subscriptions.push(disposable);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(chatProvider.id, chatProvider, {
			webviewOptions: { retainContextWhenHidden: true },
		}));
}

export function deactivate() {}
