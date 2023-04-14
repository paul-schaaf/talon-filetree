import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as utils from "./fileUtils";
import { getDirectories, lettersToNumber, numberToAlphabet } from "./utils";
const chokidar = require("chokidar");

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
    private readonly idEntryMap = new Map<number, Entry>();
    private readonly pathCollapsibleStateMap = new Map<
        string,
        vscode.TreeItemCollapsibleState
    >();
    private readonly randomNumbers: number[] = [];

    constructor() {
        const workspaceFolder = (
            vscode.workspace.workspaceFolders ?? []
        ).filter((folder) => folder.uri.scheme === "file")[0];
        if (workspaceFolder) {
            this.watch(workspaceFolder.uri);
        }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getPathFromId(id: number): string | undefined {
        return this.idPathMap.get(id);
    }

    getEntryFromId(id: number): Entry | undefined {
        return this.idEntryMap.get(id);
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

    watch(uri: vscode.Uri): vscode.Disposable {
        const watcher = chokidar.watch(uri.fsPath).on("all", async () => {
            this.idPathMap.clear();
            this.idEntryMap.clear();

            this.refresh();
        });

        return { dispose: () => watcher.close() };
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
            return children
                .filter(([name]) => !name.includes(".git"))
                .map(([name, type]) => {
                    element.counter.value += 1;
                    const uri = vscode.Uri.file(
                        path.join(element.uri.fsPath, name)
                    );
                    this.idPathMap.set(element.counter.value, uri.path);
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
            return children
                .filter(([name]) => !name.includes(".git"))
                .map(([name, type]) => {
                    counter.value += 1;
                    const uri = vscode.Uri.file(
                        path.join(workspaceFolder.uri.fsPath, name)
                    );
                    this.idPathMap.set(counter.value, uri.path);
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
            element
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
                element.uri.path
            );
            if (priorItem) {
                treeItem = new TreeItem(
                    element.uri,
                    priorItem,
                    element.id,
                    element
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
            element.uri.path,
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
        public readonly entry: Entry
    ) {
        super(resourceUri, collapsibleState);
        this.description = numberToAlphabet(customId);
    }
}

export class FileExplorer {
    private treeDataProvider: FileSystemProvider;
    private treeView: vscode.TreeView<Entry>;
    constructor(context: vscode.ExtensionContext) {
        const provider = new FileSystemProvider();
        this.treeDataProvider = provider;
        this.treeView = vscode.window.createTreeView("filetree", {
            treeDataProvider: provider
        });
        context.subscriptions.push(this.treeView);
        vscode.commands.registerCommand("fileExplorer.openFile", (resource) =>
            this.openResource(resource)
        );
        vscode.commands.registerCommand(
            "talon-filetree.toggleDirectoryOrOpenFile",
            (letters) => this.toggleDirectoryOrOpenFile(letters)
        );
        vscode.commands.registerCommand("talon-filetree.moveFile", (from, to) =>
            this.moveFile(from, to)
        );
        vscode.commands.registerCommand("talon-filetree.openFile", (letters) =>
            this.openFile(letters)
        );
        vscode.commands.registerCommand(
            "talon-filetree.renameFile",
            (letters) => this.renameFile(letters)
        );
        vscode.commands.registerCommand(
            "talon-filetree.expandDirectory",
            (letters, level) => this.expandDirectory(letters, level)
        );
        vscode.commands.registerCommand(
            "talon-filetree.createFile",
            (letters) => this.createFile(letters)
        );
        vscode.commands.registerCommand(
            "talon-filetree.deleteFile",
            (letters) => this.deleteFile(letters)
        );
        vscode.commands.registerCommand("talon-filetree.collapseRoot", () =>
            this.collapseRoot()
        );
        vscode.commands.registerCommand("talon-filetree.select", (letters) =>
            this.select(letters)
        );
    }

    private openResource(resource: vscode.Uri): void {
        vscode.window.showTextDocument(resource);
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
        const workspacePath = vscode.workspace.workspaceFolders![0].uri.path;
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
        this.treeView.reveal(entry, { focus: true });
    }

    private deleteFile(letters: string): void {
        const itemId = lettersToNumber(letters);
        if (!itemId) {
            return;
        }
        const path = this.treeDataProvider.getPathFromId(itemId);
        if (!path) {
            return;
        }
        vscode.window
            .showInformationMessage(
                `Are you sure you want to delete ${path}?`,
                { modal: true },
                "Yes",
                "No"
            )
            .then((selection) => {
                if (selection === "Yes") {
                    const isCollapsible =
                        this.treeDataProvider.isPathCollapsible(path);

                    if (isCollapsible) {
                        fs.rmdirSync(path, { recursive: true });
                    } else {
                        fs.unlinkSync(path);
                    }
                    this.treeDataProvider.deletePathFromCollapsibleStateMap(
                        path
                    );
                    this.treeDataProvider.refresh();
                }
            });
    }
}
