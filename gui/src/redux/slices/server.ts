import { createSlice } from "@reduxjs/toolkit";
import { WorkspaceFolder } from "../../protocol";

export enum ServerStatus {
    Stopped = 'Stopped',
    Starting = 'Starting',
    Running = 'Running',
    Failed = 'Failed',
}

export const serverSlice = createSlice({
    name: 'server',
    initialState: {
        status: ServerStatus.Stopped,
        workspaceFolders: [] as WorkspaceFolder[],
    },
    reducers: {
        setStatus: (state, status) => {
            state.status = status.payload;
        },
        setWorkspaceFolders: (state, status) => {
            state.workspaceFolders = status.payload;
        },
    },
});

export const { setStatus, setWorkspaceFolders } = serverSlice.actions
