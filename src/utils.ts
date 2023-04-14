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
export function numberToAlphabet(num: number) {
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    const length = alphabet.length;
    let result = "";

    while (num > 0) {
        num--; // Adjust the number to a zero-based index
        const index = num % length;
        result = alphabet[index] + result;
        num = Math.floor(num / length);
    }

    return result;
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
