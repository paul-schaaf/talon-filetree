import * as path from "path";
import * as fs from "fs";

export function getDirectories(dirPath: string, level = 0) {
    let result: { path: string; level: number }[] = [];
    try {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
                result.push({ path: filePath, level });
                result = result.concat(getDirectories(filePath, level + 1));
            }
        }
    } catch (error) {
        console.error("Error reading directory:", error);
    }

    return result;
}

export type LetterStyling = "emoji" | "lowercase" | "uppercase";
export function numberToAlphabet(num: number, letterStyling: LetterStyling) {
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    const length = alphabet.length;
    let results: string[] = [];

    while (num > 0) {
        num--; // Adjust the number to a zero-based index
        const index = num % length;
        if (letterStyling === "emoji") {
            results.push(letterToEmoji(alphabet[index]));
        } else if (letterStyling === "lowercase") {
            results.push(alphabet[index]);
        } else {
            results.push(alphabet[index].toUpperCase());
        }
        
        num = Math.floor(num / length);
    }

    results.reverse();
    return results.join("");
}
export function lettersToNumber(letters: string) {
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    const length = alphabet.length;
    let num = 0;

    for (let i = 0; i < letters.length; i++) {
        const index = alphabet.indexOf(letters[i]);
        if (index === -1) {
            return undefined;
        }
        num = num * length + (index + 1);
    }

    return num;
}

function letterToEmoji(letter: string) {
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    const emojis = [
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

    const index = alphabet.indexOf(letter);
    return emojis[index];
}
