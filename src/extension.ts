import * as cp from 'child_process';
import * as vscode from 'vscode';
import * as rpc from 'vscode-jsonrpc/node';
import * as chat from './chat';
import * as protocol from './protocol';
import * as s from './session';

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('eca.start', () => {
		const ecaChannel = vscode.window.createOutputChannel('ECA stderr', 'Clojure');

		let ecaProcess = cp.spawn('/home/greg/dev/eca/eca', ['server']);

		ecaProcess.stderr.on('data', (data) => {
			ecaChannel.appendLine(data.toString());
		});

		let connection = rpc.createMessageConnection(
			new rpc.StreamMessageReader(ecaProcess.stdout),
			new rpc.StreamMessageWriter(ecaProcess.stdin));

		let workspaceFolders = vscode.workspace.workspaceFolders?.map(f => {
			return {
				name: f.name,
				uri: f.uri.path
			};
		}) ||
			vscode.workspace.rootPath
			? [{ name: 'root', uri: vscode.workspace.rootPath! }]
			: [];

		s.init(ecaProcess, workspaceFolders);

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
			s.session.models = result.models;
			s.session.chatWelcomeMessage = result.chatWelcomeMessage;
			s.session.chatBehavior = result.chatBehavior;
			s.session.status = 'started';
			chat.openChat(context);
		});
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
