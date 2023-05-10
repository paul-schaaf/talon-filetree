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
