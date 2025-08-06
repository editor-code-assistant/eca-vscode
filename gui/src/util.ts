import { WorkspaceFolder } from "./protocol";

export function uriToPath(path: string) {
    // TODO use a lib or improve to support all uri cases
    return path.substring(path.indexOf('://') + 3).replace(/%20/g, ' ').replace(/\/\//g, '/');
}

export function relativizeFromRoot(path: string, workspaceFolders: WorkspaceFolder[]) {
    for (const root of workspaceFolders) {
        const rootPath = uriToPath(root.uri);
        if (path.startsWith(rootPath)) {
            const relativePath = path.substring(rootPath.length).replace(/^\//, '');
            return relativePath.split('/').slice(0, -1).join('/');
        }
    }

}
