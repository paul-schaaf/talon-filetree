import path = require("path");
import * as vscode from "vscode";
import assertNever from "assert-never";

const alphabet = "abcdefghijklmnopqrstuvwxyz";
const emojiLetters = [
    "Ⓐ",
    "Ⓑ",
    "Ⓒ",
    "Ⓓ",
    "Ⓔ",
    "Ⓕ",
    "Ⓖ",
    "Ⓗ",
    "Ⓘ",
    "Ⓙ",
    "Ⓚ",
    "Ⓛ",
    "Ⓜ",
    "Ⓝ",
    "Ⓞ",
    "Ⓟ",
    "Ⓠ",
    "Ⓡ",
    "Ⓢ",
    "Ⓣ",
    "Ⓤ",
    "Ⓥ",
    "Ⓦ",
    "Ⓧ",
    "Ⓨ",
    "Ⓩ"
];

const letterToEmojiMap = new Map(
    [...alphabet].map((letter, index) => [letter, emojiLetters[index]])
);

type LetterStyling = "emoji" | "lowercase" | "uppercase";
type HintPosition = "left" | "right";
type HintSeparator = "brackets" | "pipe" | "hyphen" | "colon" | "spaces";

let config: vscode.WorkspaceConfiguration;
let letterStyling: LetterStyling;
let hintPosition: HintPosition;
let hintSeparator: HintSeparator;

export function updateHintSettings() {
    config = vscode.workspace.getConfiguration("talon-filetree");
    letterStyling = config.get("letterStyling") as LetterStyling;
    hintPosition = config.get("hintPosition") as HintPosition;
    hintSeparator = config.get("hintSeparator") as HintSeparator;
}

updateHintSettings();

function getDecoratedHint(hint: string) {
    switch (letterStyling) {
        case "emoji":
            return hint
                .split("")
                .map((char) => letterToEmojiMap.get(char))
                .join("");

        case "uppercase":
            return hint.toUpperCase();

        case "lowercase":
            return hint;

        default:
            break;
    }
}

export function getDescriptionAndLabel(uri: vscode.Uri, hint: string) {
    const decoratedHint = getDecoratedHint(hint);

    if (hintPosition === "right") {
        return { description: decoratedHint };
    }

    const filename = path.basename(uri.fsPath);

    switch (hintSeparator) {
        case "brackets":
            return { label: `[${decoratedHint}] ${filename}` };
        case "pipe":
            return { label: `${decoratedHint} | ${filename}` };
        case "hyphen":
            return { label: `${decoratedHint} - ${filename}` };
        case "colon":
            return { label: `${decoratedHint}: ${filename}` };
        case "spaces":
            return { label: `${decoratedHint}  ${filename}` };
        default:
            break;
    }

    return assertNever(hintSeparator);
}

export async function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(true);
        }, ms);
    });
}

export function traverseTree<T extends { children?: T[] }>(
    root: T,
    callback: (entry: T, level: number) => void
) {
    const stack = [{ entry: root, level: 0 }];

    while (stack.length > 0) {
        const node = stack.pop()!;

        callback(node.entry, node.level);

        if (node.entry.children) {
            for (let i = node.entry.children.length - 1; i >= 0; i--) {
                stack.push({
                    entry: node.entry.children[i],
                    level: node.level + 1
                });
            }
        }
    }
}

export function getTabUri(tab: vscode.Tab) {
    const input = tab.input;
    if (
        input instanceof vscode.TabInputText ||
        input instanceof vscode.TabInputCustom ||
        input instanceof vscode.TabInputNotebook
    ) {
        return input.uri;
    }

    if (
        input instanceof vscode.TabInputTextDiff ||
        input instanceof vscode.TabInputNotebookDiff
    ) {
        return input.modified;
    }
}

export function shouldUseTrash() {
    return vscode.workspace
        .getConfiguration("files")
        .get("enableTrash") as boolean;
}

function getDeleteFolderMessage(uri: vscode.Uri) {
    const fileName = path.basename(uri.fsPath);
    const totalDirtyInFolder = vscode.workspace.textDocuments.filter(
        (td) => td.isDirty && td.uri.fsPath.startsWith(uri.fsPath)
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
        return {
            message: `Are you sure you want to delete '${fileName}' and its contents?`,
            detail: "You can restore this file from the Trash."
        };
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
        return {
            message: `Are you sure you want to delete '${fileName}'?`,
            detail: "You can restore this file from the Trash."
        };
    }

    return {
        message: `Are you sure you want to permanently delete '${fileName}'?`,
        detail: "This action is irreversible!"
    };
}

export function getDeleteMessage(uri: vscode.Uri, isFolder: boolean) {
    return isFolder ? getDeleteFolderMessage(uri) : getDeleteFileMessage(uri);
}
