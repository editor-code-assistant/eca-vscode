import { createSlice } from "@reduxjs/toolkit";
import { ToolServerUpdatedParams } from "../../protocol";

export const mcpSlice = createSlice({
    name: 'mcp',
    initialState: {
        servers: [] as ToolServerUpdatedParams[],
    },
    reducers: {
        setMcpServers: (state, action) => {
            state.servers = action.payload;
        },
    },
});

export const { setMcpServers } = mcpSlice.actions
