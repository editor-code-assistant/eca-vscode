import * as vscode from 'vscode';

export enum EcaStatus {
  Stopped = 'Stopped',
  Starting = 'Starting',
  Running = 'Running',
  Failed = 'Failed',
}

export const update = (item: vscode.StatusBarItem, status: EcaStatus) => {
    switch (status) {
        case EcaStatus.Stopped: {
            item.text = '$(circle-outline) ECA';
            item.tooltip = 'ECA is not active, click to get a menu';
            break;
        }
        case EcaStatus.Starting: {
            item.text = '$(sync~spin) ECA';
            item.tooltip = 'ECA is starting';
            break;
        }
        case EcaStatus.Running: {
            item.text = '$(circle-filled) ECA';
            item.tooltip = 'ECA is active';
            break;
        }
        case EcaStatus.Failed: {
            item.text = '$(error) ECA';
            item.tooltip = 'ECA failed to start';
            break;
        }
    }
};
