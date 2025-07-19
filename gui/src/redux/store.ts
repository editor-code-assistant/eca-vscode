import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { serverSlice } from "./slices/server";
import { mcpSlice } from "./slices/mcp";
import { useDispatch } from "react-redux";
import { chatSlice } from "./slices/chat";

const reducers = combineReducers({
    mcp: mcpSlice.reducer,
    server: serverSlice.reducer,
    chat: chatSlice.reducer,
});

const setupStore = () => {
    return configureStore({
        reducer: reducers,
    });
};

export const store = setupStore();

export type State = ReturnType<typeof reducers>;

export type ThunkApiType = {
  state: State;
};

export type EcaDispatch = typeof store.dispatch;

export const useEcaDispatch: () => EcaDispatch = useDispatch;
