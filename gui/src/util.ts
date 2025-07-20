
export function uriToPath(path: string) {
    // TODO use a lib or improve to support all uri cases
    return path.substring(path.indexOf('://') + 3).replace(/%20/g, ' ').replace(/\/\//g, '/');
}
