import path = require("path");
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

function shouldUseTrash() {
    return vscode.workspace
        .getConfiguration("files")
        .get("enableTrash") as boolean;
}

function shouldConfirmDelete() {
    return vscode.workspace
        .getConfiguration("explorer")
        .get("confirmDelete") as boolean;
}

function getDeleteFolderMessage(uri: vscode.Uri) {
    const fileName = path.basename(uri.fsPath);
    const totalDirtyInFolder = vscode.workspace.textDocuments.filter(
        (td) => td.isDirty && td.uri.fsPath.startsWith(uri.fsPath + "/")
    ).length;

    if (totalDirtyInFolder > 0) {
        return {
            message: `You are deleting a folder '${fileName}' with unsaved changes in ${totalDirtyInFolder} ${
                totalDirtyInFolder === 1 ? "file" : "files"
            }. Do you want to continue?`,
            detail: "Your changes will be lost if you don't save them."
        };
    }

    if (shouldUseTrash()) {
        if (shouldConfirmDelete()) {
            return {
                message: `Are you sure you want to delete '${fileName}' and its contents?`,
                detail: "You can restore this file from the Trash."
            };
        }

        return undefined;
    }

    return {
        message: `Are you sure you want to permanently delete '${fileName}' and its contents?`,
        detail: "This action is irreversible!"
    };
}

function getDeleteFileMessage(uri: vscode.Uri) {
    const fileName = path.basename(uri.fsPath);
    const document = vscode.workspace.textDocuments.find(
        (td) => td.uri.fsPath === uri.fsPath
    );

    if (document?.isDirty) {
        return {
            message: `You are deleting '${fileName}' with unsaved changes. Do you want to continue?`,
            detail: "Your changes will be lost if you don't save them."
        };
    }

    if (shouldUseTrash()) {
        if (shouldConfirmDelete()) {
            return {
                message: `Are you sure you want to delete '${fileName}'?`,
                detail: "You can restore this file from the Trash."
            };
        }

        return undefined;
    }

    return {
        message: `Are you sure you want to permanently delete '${fileName}'?`,
        detail: "This action is irreversible!"
    };
}

export async function confirmDeleteFile(uri: vscode.Uri) {
    const stat = await vscode.workspace.fs.stat(uri);
    const isFolder = stat.type === vscode.FileType.Directory;

    const message = isFolder
        ? getDeleteFolderMessage(uri)
        : getDeleteFileMessage(uri);

    if (!message) {
        return true;
    }

    const confirmation = await vscode.window.showInformationMessage(
        message.message,
        {
            modal: true,
            detail: message.detail
        },
        shouldUseTrash() ? "Move to Trash" : "Delete"
    );

    return Boolean(confirmation);
}
