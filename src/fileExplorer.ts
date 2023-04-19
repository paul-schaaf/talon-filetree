import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as utils from "./fileUtils";
import {
    LetterStyling,
    getDirectories,
    lettersToNumber,
    numberToAlphabet
} from "./utils";
const chokidar = require("chokidar");
import { simpleGit } from "simple-git";
const trash = require("fix-esm").require("trash");

interface Entry {
    uri: vscode.Uri;
    type: vscode.FileType;
    id: number;
    counter: {
        value: number;
    };
    parent: Entry | undefined;
}

export class FileSystemProvider implements vscode.TreeDataProvider<Entry> {
    private readonly _onDidChangeTreeData: vscode.EventEmitter<
        Entry | undefined
    > = new vscode.EventEmitter<Entry | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Entry | undefined> =
        this._onDidChangeTreeData.event;
    private readonly idPathMap = new Map<number, string>();
    private readonly pathIdMap = new Map<string, number>();
    private readonly idEntryMap = new Map<number, Entry>();
    private readonly pathCollapsibleStateMap = new Map<
        string,
        vscode.TreeItemCollapsibleState
    >();
    private readonly randomNumbers: number[] = [];
    private isGitIgnoredFilesVisible = false;
    private config: vscode.WorkspaceConfiguration;

    constructor(config: vscode.WorkspaceConfiguration) {
        this.config = config;
        const workspaceFolder = (
            vscode.workspace.workspaceFolders ?? []
        ).filter((folder) => folder.uri.scheme === "file")[0];
        if (workspaceFolder) {
            this.watch(workspaceFolder.uri);
        }
    }

    refresh(config?: vscode.WorkspaceConfiguration): void {
        if (config !== undefined) {
            this.config = config;
        }
        this._onDidChangeTreeData.fire(undefined);
    }

    getIdFromPath(path: string): number | undefined {
        return this.pathIdMap.get(path);
    }

    getPathFromId(id: number): string | undefined {
        return this.idPathMap.get(id);
    }

    getEntryFromId(id: number): Entry | undefined {
        return this.idEntryMap.get(id);
    }

    getEntryFromPath(path: string): Entry | undefined {
        const id = this.getIdFromPath(path);
        return id === undefined ? undefined : this.idEntryMap.get(id);
    }

    deletePathFromCollapsibleStateMap(path: string): void {
        this.pathCollapsibleStateMap.delete(path);
    }

    isPathCollapsible(path: string): boolean {
        return (
            this.pathCollapsibleStateMap.get(path) !==
            vscode.TreeItemCollapsibleState.None
        );
    }

    isPathExpanded(path: string): boolean {
        return (
            this.pathCollapsibleStateMap.get(path) ===
            vscode.TreeItemCollapsibleState.Expanded
        );
    }

    isPathCollapsed(path: string): boolean {
        return (
            this.pathCollapsibleStateMap.get(path) ===
            vscode.TreeItemCollapsibleState.Collapsed
        );
    }

    expandPath(path: string): void {
        this.pathCollapsibleStateMap.set(
            path,
            vscode.TreeItemCollapsibleState.Expanded
        );
    }

    collapsePath(path: string): void {
        this.pathCollapsibleStateMap.set(
            path,
            vscode.TreeItemCollapsibleState.Collapsed
        );
    }

    toggleGitIgnoredFiles(): void {
        this.isGitIgnoredFilesVisible = !this.isGitIgnoredFilesVisible;
    }

    private async isIgnored(path: string[]): Promise<string[]> {
        if (path.length === 0) {
            return [];
        }
        const workspaceFolder = (
            vscode.workspace.workspaceFolders ?? []
        ).filter((folder) => folder.uri.scheme === "file")[0];

        const result = await simpleGit(workspaceFolder.uri.fsPath).checkIgnore(
            path
        );
        return result;
    }

    watch(uri: vscode.Uri): vscode.Disposable {
        const watcher = chokidar
            .watch(uri.fsPath, {
                ignoreInitial: true
            })
            .on("all", () => {
                this.idPathMap.clear();
                this.pathIdMap.clear();
                this.idEntryMap.clear();
                this.refresh();
            });

        return {
            dispose: () => watcher.close()
        };
    }

    readDirectory(
        uri: vscode.Uri
    ): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
        return this._readDirectory(uri);
    }

    async _readDirectory(
        uri: vscode.Uri
    ): Promise<[string, vscode.FileType][]> {
        const children = await utils.readdir(uri.fsPath);

        const result: [string, vscode.FileType][] = [];
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const stat = new utils.FileStat(
                await utils.stat(path.join(uri.fsPath, child))
            );
            result.push([child, stat.type]);
        }

        return Promise.resolve(result);
    }

    // tree data provider

    async getChildren(element?: Entry): Promise<Entry[]> {
        if (element) {
            const children = await this.readDirectory(element.uri);
            children.sort((a, b) => {
                if (a[1] === b[1]) {
                    return a[0].localeCompare(b[0]);
                }
                return a[1] === vscode.FileType.Directory ? -1 : 1;
            });

            let childrenToReturn;
            if (this.isGitIgnoredFilesVisible) {
                childrenToReturn = children;
            } else {
                const ignoredPaths: string[] = await this.isIgnored(
                    children.map((c) => c[0])
                );

                const nonGitIgnoredChildren: [string, vscode.FileType][] =
                    children.filter(([name]) => !ignoredPaths.includes(name));
                childrenToReturn = nonGitIgnoredChildren;
            }

            return childrenToReturn
                .filter(([name]) => !name.endsWith(".git"))
                .map(([name, type]) => {
                    element.counter.value += 1;
                    const uri = vscode.Uri.file(
                        path.join(element.uri.fsPath, name)
                    );
                    this.idPathMap.set(element.counter.value, uri.fsPath);
                    this.pathIdMap.set(uri.fsPath, element.counter.value);
                    return {
                        uri,
                        type,
                        id: element.counter.value,
                        counter: element.counter,
                        parent: element
                    };
                });
        }

        const counter = { value: 0 };

        const workspaceFolder = (
            vscode.workspace.workspaceFolders ?? []
        ).filter((folder) => folder.uri.scheme === "file")[0];
        if (workspaceFolder) {
            const children = await this.readDirectory(workspaceFolder.uri);
            children.sort((a, b) => {
                if (a[1] === b[1]) {
                    return a[0].localeCompare(b[0]);
                }
                return a[1] === vscode.FileType.Directory ? -1 : 1;
            });

            let childrenToReturn;
            if (this.isGitIgnoredFilesVisible) {
                childrenToReturn = children;
            } else {
                const ignoredPaths: string[] = await this.isIgnored(
                    children.map((c) => c[0])
                );

                const nonGitIgnoredChildren: [string, vscode.FileType][] =
                    children.filter(([name]) => !ignoredPaths.includes(name));
                childrenToReturn = nonGitIgnoredChildren;
            }

            return childrenToReturn
                .filter(([name]) => !name.endsWith(".git"))
                .map(([name, type]) => {
                    counter.value += 1;
                    const uri = vscode.Uri.file(
                        path.join(workspaceFolder.uri.fsPath, name)
                    );
                    this.idPathMap.set(counter.value, uri.fsPath);
                    this.pathIdMap.set(uri.fsPath, counter.value);
                    return {
                        uri,
                        type,
                        id: counter.value,
                        counter,
                        parent: undefined
                    };
                });
        }

        return [];
    }

    getParent(element: Entry): vscode.ProviderResult<Entry> {
        return element.parent;
    }

    getTreeItem(element: Entry): vscode.TreeItem {
        let treeItem = new TreeItem(
            element.uri,
            element.type === vscode.FileType.Directory
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None,
            element.id,
            element,
            this.config.get("letterStyling")!
        );
        if (element.type === vscode.FileType.File) {
            treeItem.command = {
                command: "fileExplorer.openFile",
                title: "Open File",
                arguments: [element.uri]
            };
            treeItem.contextValue = "file";
        } else {
            const priorItem = this.pathCollapsibleStateMap.get(
                element.uri.fsPath
            );
            if (priorItem) {
                treeItem = new TreeItem(
                    element.uri,
                    priorItem,
                    element.id,
                    element,
                    this.config.get("letterStyling")!
                );
                let randomNumber;
                while (true) {
                    randomNumber = Math.random();
                    if (this.randomNumbers.includes(randomNumber)) {
                        continue;
                    }
                    this.randomNumbers.push(randomNumber);
                    const index = this.randomNumbers.indexOf(element.id, 0);
                    if (index > -1) {
                        this.randomNumbers.splice(index, 1);
                    }
                    break;
                }
                treeItem.id = randomNumber.toString();
            }
        }
        this.idEntryMap.set(element.id, element);
        this.pathCollapsibleStateMap.set(
            element.uri.fsPath,
            treeItem.collapsibleState!
        );
        return treeItem;
    }
}

class TreeItem extends vscode.TreeItem {
    constructor(
        resourceUri: vscode.Uri,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly customId: number,
        public readonly entry: Entry,
        readonly letterStyling: LetterStyling
    ) {
        super(resourceUri, collapsibleState);
        this.description = numberToAlphabet(customId, letterStyling);
    }
}

export class FileExplorer {
    private treeDataProvider: FileSystemProvider;
    private treeView: vscode.TreeView<Entry>;

    constructor(context: vscode.ExtensionContext) {
        const provider = new FileSystemProvider(
            vscode.workspace.getConfiguration("talon-filetree")
        );
        this.treeDataProvider = provider;
        this.treeView = vscode.window.createTreeView("filetree", {
            treeDataProvider: provider
        });
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(() => {
                this.treeDataProvider.refresh(
                    vscode.workspace.getConfiguration("talon-filetree")
                );
            }, this)
        );

        // these two subscriptions make sure
        // that the extension's collasible state
        // map is kept up to date when user uses
        // mouse clicks to expand/collapse
        // instead of the extension's provided commands
        this.treeView.onDidExpandElement((event) => {
            this.treeDataProvider.expandPath(event.element.uri.fsPath);
        });
        this.treeView.onDidCollapseElement((event) => {
            this.treeDataProvider.collapsePath(event.element.uri.fsPath);
        });

        context.subscriptions.push(this.treeView);
        vscode.commands.registerCommand("fileExplorer.openFile", (resource) =>
            this.showMessageIfError(() => this.openResource(resource))
        );
        vscode.commands.registerCommand(
            "talon-filetree.toggleDirectoryOrOpenFile",
            (letters) =>
                this.showMessageIfError(() =>
                    this.toggleDirectoryOrOpenFile(letters)
                )
        );
        vscode.commands.registerCommand("talon-filetree.moveFile", (from, to) =>
            this.showMessageIfError(() => this.moveFile(from, to))
        );
        vscode.commands.registerCommand("talon-filetree.openFile", (letters) =>
            this.showMessageIfError(() => this.openFile(letters))
        );
        vscode.commands.registerCommand(
            "talon-filetree.renameFile",
            (letters) => this.showMessageIfError(() => this.renameFile(letters))
        );
        vscode.commands.registerCommand(
            "talon-filetree.expandDirectory",
            (letters, level) =>
                this.showMessageIfError(() =>
                    this.expandDirectory(letters, level)
                )
        );
        vscode.commands.registerCommand(
            "talon-filetree.createFile",
            (letters) => this.showMessageIfError(() => this.createFile(letters))
        );
        vscode.commands.registerCommand(
            "talon-filetree.deleteFile",
            (letters) => this.showMessageIfError(() => this.deleteFile(letters))
        );
        vscode.commands.registerCommand("talon-filetree.collapseRoot", () =>
            this.showMessageIfError(() => this.collapseRoot())
        );
        vscode.commands.registerCommand("talon-filetree.select", (letters) =>
            this.showMessageIfError(() => this.select(letters))
        );
        vscode.commands.registerCommand(
            "talon-filetree.closeParent",
            (letters) =>
                this.showMessageIfError(() =>
                    this.closeParentDirectory(letters)
                )
        );
        vscode.commands.registerCommand(
            "talon-filetree.toggleGitIgnoredFiles",
            () => this.showMessageIfError(() => this.toggleGitIgnoredFiles())
        );
        vscode.commands.registerCommand(
            "talon-filetree.revealCurrentFile",
            () => this.showMessageIfError(() => this.revealCurrentFile())
        );
    }

    private showMessageIfError(f: any): void {
        try {
            f();
        } catch (e: any) {
            vscode.window.showErrorMessage(e.message);
            throw e;
        }
    }

    private openResource(resource: vscode.Uri): void {
        vscode.window.showTextDocument(resource);
    }

    private revealCurrentFile(): void {
        const editor = vscode.window.activeTextEditor;
        if (editor === undefined) {
            return;
        }
        const workspaceFolder = (
            vscode.workspace.workspaceFolders ?? []
        ).filter((folder) => folder.uri.scheme === "file")[0];
        if (
            !editor.document.uri.fsPath.startsWith(workspaceFolder.uri.fsPath)
        ) {
            vscode.window.showErrorMessage(
                "Currently selected file is not a member of active workspace!"
            );
            return;
        }

        const directoriesToExpand = [];
        const filePath = editor.document.uri.fsPath;
        let currentPath = path.dirname(filePath);
        while (true) {
            if (currentPath === workspaceFolder.uri.fsPath) {
                break;
            }
            directoriesToExpand.push(currentPath);
            currentPath = path.dirname(currentPath);
        }
        directoriesToExpand.reverse();
        for (const directory of directoriesToExpand) {
            this.treeDataProvider.expandPath(directory);
        }

        this.treeDataProvider.refresh();

        const interval = setInterval(() => {
            console.log("checking");
            const entry = this.treeDataProvider.getEntryFromPath(filePath);
            if (entry) {
                this.treeView.reveal(entry, { focus: true });
                if (this.treeView.selection.includes(entry)) {
                    clearInterval(interval);
                }
            }
        }, 10);

        // We add this just as a failsafe mechanism in case the entry never gets
        // selected for whatever reason
        setTimeout(() => {
            clearInterval(interval);
        }, 3000);
    }

    private toggleGitIgnoredFiles(): void {
        this.treeDataProvider.toggleGitIgnoredFiles();
        this.treeDataProvider.refresh();
    }

    private toggleDirectoryOrOpenFile(letters: string): void {
        const itemId = lettersToNumber(letters);
        if (itemId === undefined) {
            return;
        }
        const path = this.treeDataProvider.getPathFromId(itemId);
        if (path) {
            const isCollapsible = this.treeDataProvider.isPathCollapsible(path);
            if (isCollapsible) {
                if (this.treeDataProvider.isPathCollapsed(path)) {
                    this.treeDataProvider.expandPath(path);
                } else {
                    this.treeDataProvider.collapsePath(path);
                }
                this.treeDataProvider.refresh();
            } else {
                this.openResource(vscode.Uri.file(path));
            }
        }
    }

    private closeParentDirectory(letters: string): void {
        const itemId = lettersToNumber(letters);
        if (itemId === undefined) {
            return;
        }
        const parentEntry =
            this.treeDataProvider.getEntryFromId(itemId)!.parent;
        if (parentEntry === undefined) {
            vscode.window.showErrorMessage(
                "Cannot close parent of workspace directory!"
            );
            return;
        }
        const parentPath = this.treeDataProvider.getPathFromId(parentEntry.id)!;
        this.treeDataProvider.collapsePath(parentPath);
        this.treeDataProvider.refresh();
    }

    private expandDirectory(letters: string, levelString: string): void {
        const itemId = lettersToNumber(letters);
        if (itemId === undefined) {
            return;
        }
        const path = this.treeDataProvider.getPathFromId(itemId)!;
        const level = parseInt(levelString);
        const isCollapsible = this.treeDataProvider.isPathCollapsible(path);
        if (!isCollapsible) {
            vscode.window.showErrorMessage(
                "This commands expects a directory but you picked a file!"
            );
            return;
        }

        if (!this.treeDataProvider.isPathExpanded(path)) {
            this.treeDataProvider.expandPath(path);
        }
        for (const directory of getDirectories(path)) {
            if (directory.level >= level) {
                this.treeDataProvider.collapsePath(directory.path);
            } else if (!this.treeDataProvider.isPathExpanded(directory.path)) {
                this.treeDataProvider.expandPath(directory.path);
            }
        }
        this.treeDataProvider.refresh();
    }

    private collapseRoot(): void {
        const workspacePath = vscode.workspace.workspaceFolders![0].uri.fsPath;
        for (const directory of getDirectories(workspacePath)) {
            if (directory.level === 0) {
                this.treeDataProvider.collapsePath(directory.path);
            }
        }
        this.treeDataProvider.refresh();
    }

    private openFile(letters: string): void {
        const itemId = lettersToNumber(letters);
        if (!itemId) {
            return;
        }
        const path = this.treeDataProvider.getPathFromId(itemId);
        if (path) {
            const isCollapsible = this.treeDataProvider.isPathCollapsible(path);
            if (isCollapsible) {
                vscode.window.showErrorMessage(
                    "This commands expects a file but you picked a directory!"
                );
                return;
            }
            this.openResource(vscode.Uri.file(path));
        }
    }

    private renameFile(letters: string): void {
        const itemId = lettersToNumber(letters);
        if (!itemId) {
            return;
        }
        const path = this.treeDataProvider.getPathFromId(itemId);
        if (path) {
            vscode.commands.executeCommand(
                "fileutils.renameFile",
                vscode.Uri.file(path)
            );
        }
    }

    private moveFile(from: string, to: string | undefined): void {
        const fromId = lettersToNumber(from);
        if (!fromId) {
            return;
        }
        const fromPath = this.treeDataProvider.getPathFromId(fromId);
        if (fromPath === undefined) {
            return;
        }
        const fileName = path.basename(fromPath);
        if (to === undefined) {
            // move to workspace root
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(
                vscode.Uri.file(fromPath)
            );
            if (workspaceFolder) {
                const newPath = path.join(workspaceFolder.uri.fsPath, fileName);
                fs.renameSync(fromPath, newPath);
            }
        } else {
            const toId = lettersToNumber(to);
            if (!toId) {
                return;
            }
            const toPath = this.treeDataProvider.getPathFromId(toId);
            if (!toPath) {
                return;
            }
            const isCollapsible =
                this.treeDataProvider.isPathCollapsible(toPath);
            let newPath;
            if (isCollapsible) {
                newPath = path.join(toPath, fileName);
            } else {
                newPath = path.join(path.dirname(toPath), fileName);
            }
            fs.renameSync(fromPath, newPath);
        }
    }

    private createFile(letters: string): void {
        const itemId = lettersToNumber(letters);
        if (!itemId) {
            return;
        }
        const itemPath = this.treeDataProvider.getPathFromId(itemId);
        if (itemPath) {
            const isCollapsible =
                this.treeDataProvider.isPathCollapsible(itemPath);
            let directoryPath: string;
            if (isCollapsible) {
                directoryPath = itemPath;
            } else {
                directoryPath = path.dirname(itemPath);
            }
            vscode.window
                .showInputBox({
                    prompt: `Creating file in directory ${path.basename(
                        directoryPath
                    )}. Enter file name! End the file name with a slash to create a folder.`
                })
                .then((fileName) => {
                    if (fileName) {
                        if (fileName[fileName.length - 1] !== "/") {
                            let filePath = path.join(directoryPath, fileName);
                            if (fs.existsSync(filePath)) {
                                vscode.window.showErrorMessage(
                                    "File already exists!"
                                );
                                return;
                            }
                            fs.writeFileSync(filePath, "");
                            this.openResource(vscode.Uri.file(filePath));
                        } else {
                            const result = fileName.substring(
                                0,
                                fileName.length - 1
                            );
                            let dirPath = path.join(directoryPath, result);
                            fs.mkdirSync(dirPath);
                            this.treeDataProvider.expandPath(dirPath);
                            this.treeDataProvider.refresh();
                        }
                    }
                });
        }
    }

    private select(letters: string): void {
        const itemId = lettersToNumber(letters);
        if (!itemId) {
            return;
        }
        const entry = this.treeDataProvider.getEntryFromId(itemId)!;
        this.treeView.reveal(entry, {
            focus: true
        });
    }

    private async deleteFile(letters: string): Promise<void> {
        const itemId = lettersToNumber(letters);
        if (!itemId) {
            return;
        }
        const path = this.treeDataProvider.getPathFromId(itemId);
        if (!path) {
            return;
        }
        const selection = await vscode.window.showInformationMessage(
            `Are you sure you want to delete ${path}?`,
            { modal: true },
            "Yes",
            "No"
        );
        if (selection === "Yes") {
            await trash.default(path);

            this.treeDataProvider.deletePathFromCollapsibleStateMap(path);
            this.treeDataProvider.refresh();
        }
    }
}
