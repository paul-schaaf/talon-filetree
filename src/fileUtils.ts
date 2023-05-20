import simpleGit from "simple-git";
import * as vscode from "vscode";

export async function exists(resource: vscode.Uri) {
    try {
        await vscode.workspace.fs.stat(resource);
        return true;
    } catch {
        return false;
    }
}

export async function getDescendantFolders(
    uri: vscode.Uri,
    maxLevels: number
): Promise<string[]> {
    async function processFolder(
        folderUri: vscode.Uri,
        level: number
    ): Promise<string[]> {
        if (level > maxLevels) {
            return [];
        }

        const descendantFolders: string[] = [];
        const entries = await vscode.workspace.fs.readDirectory(folderUri);

        const subfolderPromises = entries
            .filter(([_, entryType]) => entryType === vscode.FileType.Directory)
            .map(async ([entryName, _]) => {
                const subFolderUri = vscode.Uri.joinPath(folderUri, entryName);
                descendantFolders.push(subFolderUri.fsPath);
                return processFolder(subFolderUri, level + 1);
            });

        const subfolders = await Promise.all(subfolderPromises);
        return descendantFolders.concat(...subfolders);
    }

    return processFolder(uri, 1);
}

export async function getGitIgnored(root: string, paths: string[]) {
    try {
        return await simpleGit(root).checkIgnore(paths);
    } catch {
        return [];
    }
}

export function getActiveTabUri() {
    // Using this instead of vscode.window.activeTextEditor so that it works
    // with files that are not text, like images
    const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input as
        | { uri?: vscode.Uri }
        | { modified?: vscode.Uri }
        | undefined;

    if (!input) {
        return undefined;
    }

    if ("uri" in input) {
        return input.uri;
    }

    if ("modified" in input) {
        return input.modified;
    }

    return undefined;
}
