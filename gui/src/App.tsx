import { RouterProvider, createMemoryRouter } from "react-router-dom";
import Chat from "./pages";

export const ROUTES = {
    CHAT: "/",
    MCP_DETAILS: "/mcp-details",
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
             *     path: ROUTES.MCP_DETAILS,
             *     element: <McpDetailsPage />,
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
