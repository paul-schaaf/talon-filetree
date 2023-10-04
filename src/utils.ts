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
            return letterToEmojiMap.get(hint);

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
