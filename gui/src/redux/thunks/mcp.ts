import { createAsyncThunk } from "@reduxjs/toolkit";
import { webviewSend } from "../../hooks";
import { ThunkApiType } from "../store";

export const startServer = createAsyncThunk<void, { name: string }, ThunkApiType>(
    "mcp/startServer",
    async ({ name }, {}) => {
        webviewSend('mcp/startServer', { name });
    }
);

export const stopServer = createAsyncThunk<void, { name: string }, ThunkApiType>(
    "mcp/stopServer",
    async ({ name }, {}) => {
        webviewSend('mcp/stopServer', { name });
    }
);
