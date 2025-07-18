import { createSlice } from "@reduxjs/toolkit";
import { MCPServerUpdatedParams } from "../../protocol";

export const mcpSlice = createSlice({
    name: 'mcp',
    initialState: {
        servers: [] as MCPServerUpdatedParams[],
    },
    reducers: {
        setMcpServers: (state, action) => {
            state.servers = action.payload;
        },
    },
});

export const { setMcpServers } = mcpSlice.actions
