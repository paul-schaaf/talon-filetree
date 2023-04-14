import * as vscode from "vscode";
import * as fs from "fs";

export class FileStat implements vscode.FileStat {
    constructor(private fsStat: fs.Stats) {}

    get type(): vscode.FileType {
        return this.fsStat.isFile()
            ? vscode.FileType.File
            : this.fsStat.isDirectory()
            ? vscode.FileType.Directory
            : this.fsStat.isSymbolicLink()
            ? vscode.FileType.SymbolicLink
            : vscode.FileType.Unknown;
    }

    get isFile(): boolean | undefined {
        return this.fsStat.isFile();
    }

    get isDirectory(): boolean | undefined {
        return this.fsStat.isDirectory();
    }

    get isSymbolicLink(): boolean | undefined {
        return this.fsStat.isSymbolicLink();
    }

    get size(): number {
        return this.fsStat.size;
    }

    get ctime(): number {
        return this.fsStat.ctime.getTime();
    }

    get mtime(): number {
        return this.fsStat.mtime.getTime();
    }
}

function handleResult<T>(
    resolve: (result: T) => void,
    reject: (error: Error) => void,
    error: Error | null | undefined,
    result: T
): void {
    if (error) {
        reject(massageError(error));
    } else {
        resolve(result);
    }
}

function massageError(error: Error & { code?: string }): Error {
    if (error.code === "ENOENT") {
        return vscode.FileSystemError.FileNotFound();
    }

    if (error.code === "EISDIR") {
        return vscode.FileSystemError.FileIsADirectory();
    }

    if (error.code === "EEXIST") {
        return vscode.FileSystemError.FileExists();
    }

    if (error.code === "EPERM" || error.code === "EACCESS") {
        return vscode.FileSystemError.NoPermissions();
    }

    return error;
}

export function normalizeNFC(items: string[]): string[];
export function normalizeNFC(items: string | string[]): string | string[] {
    if (process.platform !== "darwin") {
        return items;
    }

    if (Array.isArray(items)) {
        return items.map((item) => item.normalize("NFC"));
    }

    return items.normalize("NFC");
}

export function readdir(path: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
        fs.readdir(path, (error, children) =>
            handleResult(resolve, reject, error, normalizeNFC(children))
        );
    });
}

export function stat(path: string): Promise<fs.Stats> {
    return new Promise<fs.Stats>((resolve, reject) => {
        fs.stat(path, (error, stat) =>
            handleResult(resolve, reject, error, stat)
        );
    });
}
