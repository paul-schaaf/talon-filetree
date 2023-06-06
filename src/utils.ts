import * as vscode from "vscode";

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

export type LetterStyling = "emoji" | "lowercase" | "uppercase";

let config: vscode.WorkspaceConfiguration;
let letterStyling: LetterStyling;

export function updateLetterStyling() {
    config = vscode.workspace.getConfiguration("talon-filetree");
    letterStyling = config.get("letterStyling") as LetterStyling;
}

updateLetterStyling();

export function getDecoratedHint(hint: string) {
    switch (letterStyling) {
        case "emoji":
            return letterToEmojiMap.get(hint);

        case "uppercase":
            return hint.toUpperCase();

        case "lowercase":
            return hint;

        default:
            break;
    }
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
