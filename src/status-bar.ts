import * as vscode from 'vscode';
import { EcaServerStatus } from './server';

export const update = (item: vscode.StatusBarItem, status: EcaServerStatus) => {
    switch (status) {
        case EcaServerStatus.Stopped: {
            item.text = '$(circle-outline) ECA';
            item.tooltip = 'ECA is not active, click to get a menu';
            break;
        }
        case EcaServerStatus.Starting: {
            item.text = '$(sync~spin) ECA';
            item.tooltip = 'ECA is starting';
            break;
        }
        case EcaServerStatus.Running: {
            item.text = '$(circle-filled) ECA';
            item.tooltip = 'ECA is active';
            break;
        }
        case EcaServerStatus.Failed: {
            item.text = '$(error) ECA';
            item.tooltip = 'ECA failed to start';
            break;
        }
    }
};
