import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { serverSlice } from "./slices/server";
import { useDispatch } from "react-redux";
import { chatSlice } from "./slices/chat";

const reducers = combineReducers({
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

export type EcaDispatch = typeof store.dispatch;

export const useEcaDispatch: () => EcaDispatch = useDispatch;
