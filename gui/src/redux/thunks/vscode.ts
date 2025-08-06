import { createAsyncThunk } from "@reduxjs/toolkit";
import { webviewSend } from "../../hooks";
import { ThunkApiType } from "../store";

export const openFileInEditor = createAsyncThunk<void, { path: string }, ThunkApiType>(
    "vscode/openFileInEditor",
    async ({ path }, _) => {
        webviewSend('vscode/openFileInEditor', { path });
    }
);
