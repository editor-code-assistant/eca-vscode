import * as vscode from 'vscode';
import { EcaServerStatus } from './server';
import { EcaServer } from './server';

const manageHandler = async (
    server: EcaServer,
    context: vscode.ExtensionContext,
) => {
    type Choice = vscode.QuickPickItem & { value?: string; };
    const choices: Choice[] = [];

    if (server.status == EcaServerStatus.Running) {
        choices.push({ label: 'Stop ECA server', value: '::stop' });
    } else if (server.status == EcaServerStatus.Stopped || server.status == EcaServerStatus.Failed) {
        choices.push({ label: 'Start ECA server', value: '::start' });
    }

    const picker = vscode.window.createQuickPick();
    picker.items = choices;
    picker.title = 'ECA';
    picker.placeholder = 'Select an action';

    picker.show();

    const choice = await new Promise<Choice | undefined>((resolve) => {
        picker.onDidAccept(() => resolve(picker.selectedItems[0]));
        picker.onDidHide(() => resolve(undefined));
    });
    picker.dispose();

    if (!choice) {
        return;
    }

    switch (choice.value) {
        case '::start': {
            server.start();
            return;
        }
        case '::stop': {
            server.stop();
            return;
        }
    }

};

type RegisterCommandsParams = {
    server: EcaServer,
    context: vscode.ExtensionContext;
};

export const registerVSCodeCommands = (params: RegisterCommandsParams) => {
    return [
        vscode.commands.registerCommand('eca.manage', () => {
            manageHandler(params.server, params.context)
                .catch((err) => console.error('Failed to run manage command', err));
        }),
        vscode.commands.registerCommand('eca.start', () => {
            // TODO
        }),
        vscode.commands.registerCommand('eca.stop', () => {
            // TODO
        }),
    ];
};
