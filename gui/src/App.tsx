import { RouterProvider, createMemoryRouter } from "react-router-dom";
import './App.scss';
import Chat from "./pages";

export const ROUTES = {
    CHAT: "/",
    MCP_SETTINGS: "/mcp",
};

const router = createMemoryRouter([
    {
        path: ROUTES.CHAT,
        /* element: <Layout />, */
        /* errorElement: <ErrorPage />, */
        children: [
            {
                path: "/index.html",
                element: <Chat />,
            },
            {
                path: ROUTES.CHAT,
                element: <Chat />,
            },
            // TODO
            /* {
             *     path: ROUTES.MCP_SETTINGS,
             *     element: <McpSettingsPage />,
             * }, */
        ],
    },
]);

function App() {
    return (
        <RouterProvider router={router} />
    );
}

export default App
