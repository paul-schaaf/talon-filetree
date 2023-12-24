import * as vscode from "vscode";
import * as path from "path";
import { HintManager } from "./HintManager";
import {
    exists,
    getActiveTabUri,
    getDescendantFolders,
    getGitIgnored
} from "./fileUtils";
import {
    getDescriptionAndLabel,
    sleep,
    traverseTree,
    updateHintSettings
} from "./utils";
import { minimatch } from "minimatch";

export class FileDataProvider implements vscode.TreeDataProvider<Entry> {
    private readonly _onDidChangeTreeData: vscode.EventEmitter<
        Entry | undefined
    > = new vscode.EventEmitter<Entry | undefined>();

    readonly onDidChangeTreeData: vscode.Event<Entry | undefined> =
        this._onDidChangeTreeData.event;

    private readonly pathEntryMap = new Map<string, Entry>();
    private readonly hintEntryMap = new Map<string, Entry>();

    private readonly hintManager = new HintManager();
    private counter = 0;
    private excludeGitIgnore: boolean;
    private excludeGlobPatterns = <string[]>[];

    private foldersToExpand = new Set<string>();

    private collapseWorkspaceFolders = false;

    constructor(context: vscode.ExtensionContext) {
        this.excludeGitIgnore = vscode.workspace
            .getConfiguration("explorer")
            .get("excludeGitIgnore") as boolean;

        const filesExclude = vscode.workspace
            .getConfiguration("files")
            .get("exclude") as Record<string, boolean>;
        this.excludeGlobPatterns = Object.keys(filesExclude);

        context.subscriptions.push(this.watch());
    }

    refresh(entry?: Entry) {
        if (!entry) {
            this.excludeGitIgnore = vscode.workspace
                .getConfiguration("explorer")
                .get("excludeGitIgnore") as boolean;

            const filesExclude = vscode.workspace
                .getConfiguration("files")
                .get("exclude") as Record<string, boolean>;
            this.excludeGlobPatterns = Object.keys(filesExclude);
        }

        this._onDidChangeTreeData.fire(entry);
    }

    hintRefresh() {
        for (const entry of this.hintEntryMap.values()) {
            entry.hint = undefined;
        }

        this.hintManager.reset();
        this.refresh();
    }

    watch() {
        const watcher = vscode.workspace.createFileSystemWatcher("**/*");

        watcher.onDidCreate(async (uri) => {
            const parentPath = path.dirname(uri.fsPath);
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);

            if (!workspaceFolder) {
                return;
            }

            if (parentPath === workspaceFolder.uri.fsPath) {
                this.refresh();
            } else {
                const parentEntry = await this.getEntryFromPath(parentPath);

                // If there is no parentEntry it might be because it is
                // collapsed or git ignored
                if (parentEntry) {
                    this.refresh(parentEntry);
                }
            }
        });

        watcher.onDidDelete(async (uri) => {
            const parentPath = path.dirname(uri.fsPath);
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);

            if (!workspaceFolder) {
                return;
            }

            if (parentPath === workspaceFolder.uri.fsPath) {
                this.refresh();
            } else {
                const parentEntry = await this.getEntryFromPath(parentPath);

                // If there is no parentEntry it might be because it is
                // collapsed or git ignored
                if (parentEntry) {
                    this.refresh(parentEntry);
                }
            }

            await this.removeEntry(uri);
        });

        watcher.onDidChange((uri) => {
            if (
                path.basename(uri.fsPath) === ".gitignore" &&
                this.excludeGitIgnore
            ) {
                this.refresh();
            }
        });

        return watcher;
    }

    async getEntryFromPath(path: string): Promise<Entry | undefined> {
        return new Promise((resolve) => {
            let timedOut = false;

            const timeout = setTimeout(() => {
                timedOut = true;
                resolve(undefined);
            }, 1000);

            const getEntry = () => {
                const entry = this.pathEntryMap.get(path);
                if (!entry && !timedOut) {
                    setTimeout(() => {
                        getEntry();
                    }, 20);
                } else {
                    clearTimeout(timeout);
                    resolve(entry);
                }
            };

            getEntry();
        });
    }

    getEntryFromHint(hint: string) {
        const entry = this.hintEntryMap.get(hint);
        if (!entry) {
            throw new Error(`No entry for hint '${hint}'`);
        }

        return entry;
    }

    /**
     * After calling this method it's very important to remember to call
     * `treeDataProvider.refresh(entry)`. It's necessary so that the tree updates
     * and to keep the hints in sync.
     */
    preExpandToLevel(entry: Entry, level: number) {
        traverseTree(entry, (current, currentLevel) => {
            if (currentLevel > 0 && current.isFolder) {
                // Next time getChildren is called on the parent the entry will
                // get a new id. This is to be able to redefine the entry's
                // collapsibleState.
                current.id = undefined;
            }

            if (currentLevel > level) {
                this.pathEntryMap.delete(current.resourceUri.fsPath);

                if (current.hint) {
                    this.hintManager.restore(current.hint);
                    this.hintEntryMap.delete(current.hint);
                }
            }
        });
    }

    // The property collapsibleState only determines the initial collapsible
    // state of a TreeItem and it doesn't change, we change it ourselves to
    // keep track of the element's collapsible state
    entryWasExpanded(entry: Entry) {
        entry.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    }

    async entryWasCollapsed(entry: Entry) {
        entry.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

        // This is to avoid running out of one or two letter hints after opening
        // and closing a large folder like node_modules
        if (entry.children && entry.children.length > 100) {
            if (entry.children) {
                for (const child of entry.children) {
                    await this.removeEntry(child.resourceUri, false);
                }
            }
            this.refresh(entry.parent);
        }
    }

    postCollapseRoot() {
        this.hintManager.reset();
        this.hintEntryMap.clear();
        this.pathEntryMap.clear();
        this.collapseWorkspaceFolders = true;
        this.refresh();
    }

    async removeEntry(uri: vscode.Uri, hard = true) {
        const entryToRemove = await this.getEntryFromPath(uri.fsPath);

        if (!entryToRemove) {
            return;
        }

        if (entryToRemove.hint) {
            this.hintManager.restore(entryToRemove.hint);
            this.hintEntryMap.delete(entryToRemove.hint);
            entryToRemove.hint = undefined;
        }

        // If hard is false we don't remove it from pathEntryMap because we want
        // to restore its collapsibleState for when the entry is generated again
        // in getChildren
        if (hard) {
            this.pathEntryMap.delete(entryToRemove.resourceUri.fsPath);
        }

        if (entryToRemove?.children) {
            for (const children of entryToRemove.children) {
                await this.removeEntry(children.resourceUri, hard);
            }
        }
    }

    addFoldersToExpand(folders: string[]) {
        for (const folder of folders) {
            this.foldersToExpand.add(folder);
        }
    }

    async getChildren(entry?: Entry) {
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders) {
            return [];
        }

        // Multiple workspace folders
        if (!entry && workspaceFolders.length > 1) {
            const children = workspaceFolders.map((folder) => folder.uri);
            const collapsibleState = this.collapseWorkspaceFolders
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.Expanded;
            this.collapseWorkspaceFolders = false;

            return children.map((child) => {
                const hint = this.hintManager.get();

                const entry = new Entry(
                    child,
                    collapsibleState,
                    vscode.FileType.Directory,
                    undefined,
                    String(this.counter++),
                    hint
                );

                this.pathEntryMap.set(child.fsPath, entry);

                if (hint) {
                    this.hintEntryMap.set(hint, entry);
                }

                return entry;
            });
        }

        const rootUri = entry
            ? entry.resourceUri
            : vscode.workspace.workspaceFolders![0].uri;
        const children = await vscode.workspace.fs.readDirectory(rootUri);

        children.sort((a, b) => {
            if (a[1] === b[1]) {
                return a[0].localeCompare(b[0]);
            }
            return a[1] === vscode.FileType.Directory ? -1 : 1;
        });

        const childPaths = children.map((child) => child[0]);
        const childrenToIgnore =
            this.excludeGitIgnore && childPaths.length > 0
                ? await getGitIgnored(rootUri.fsPath, childPaths)
                : [];

        const childEntries = children
            .map(([name, type]) => {
                const uri = vscode.Uri.joinPath(rootUri, name);

                const matchesExcludeGlobPattern = this.excludeGlobPatterns.some(
                    (pattern) => minimatch(uri.fsPath, pattern, { dot: true })
                );

                if (
                    childrenToIgnore.includes(name) ||
                    matchesExcludeGlobPattern
                ) {
                    return undefined;
                }

                const previousEntry = this.pathEntryMap.get(uri.fsPath);

                const hint = previousEntry?.hint ?? this.hintManager.get();

                let collapsibleState =
                    type === vscode.FileType.Directory
                        ? vscode.TreeItemCollapsibleState.Collapsed
                        : vscode.TreeItemCollapsibleState.None;

                if (this.foldersToExpand.has(uri.fsPath)) {
                    collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                    this.foldersToExpand.delete(uri.fsPath);
                }

                if (
                    previousEntry?.collapsibleState &&
                    previousEntry.id !== undefined
                ) {
                    collapsibleState = previousEntry.collapsibleState;
                }

                const id = previousEntry?.id ?? String(this.counter++);

                const childEntry = new Entry(
                    uri,
                    collapsibleState,
                    type,
                    entry,
                    id,
                    hint
                );

                this.pathEntryMap.set(uri.fsPath, childEntry);

                if (hint) {
                    this.hintEntryMap.set(hint, childEntry);
                }

                return childEntry;
            })
            .filter((item): item is Entry => item !== undefined);

        if (entry && entry.isFolder) {
            entry.children = childEntries;
        }

        return childEntries;
    }

    getParent(entry: Entry): vscode.ProviderResult<Entry> {
        return entry.parent;
    }

    getTreeItem(entry: Entry): vscode.TreeItem {
        return entry;
    }
}

class Entry extends vscode.TreeItem {
    type: vscode.FileType;
    parent: Entry | undefined;
    resourceUri: vscode.Uri;
    children?: Entry[];
    isFolder: boolean;
    id?: string;

    constructor(
        resourceUri: vscode.Uri,
        collapsibleState: vscode.TreeItemCollapsibleState,
        type: vscode.FileType,
        parent: Entry | undefined,
        id: string,
        public hint?: string
    ) {
        super(resourceUri, collapsibleState);
        if (hint) {
            const { label, description } = getDescriptionAndLabel(
                resourceUri,
                hint
            );
            this.description = description;
            this.label = label;
        }

        this.resourceUri = resourceUri;
        this.type = type;
        this.parent = parent;
        this.id = id;
        this.isFolder =
            this.collapsibleState !== vscode.TreeItemCollapsibleState.None;

        if (this.type === vscode.FileType.File) {
            this.command = {
                command: "talon-filetree.openResource",
                title: "Open File",
                arguments: [this.resourceUri]
            };
        }
    }
}

export class FileExplorer {
    private treeDataProvider: FileDataProvider;
    private treeView: vscode.TreeView<Entry>;

    private autoReveal: boolean;
    private autoRevealExcludeGlobPatterns = <string[]>[];

    constructor(context: vscode.ExtensionContext) {
        this.treeDataProvider = new FileDataProvider(context);

        this.treeView = vscode.window.createTreeView("filetree", {
            treeDataProvider: this.treeDataProvider
        });

        this.autoReveal = vscode.workspace
            .getConfiguration("explorer")
            .get("autoReveal") as boolean;

        const autoRevealeExclude = vscode.workspace
            .getConfiguration("explorer")
            .get("autoRevealExclude") as Record<string, boolean>;
        this.autoRevealExcludeGlobPatterns = Object.keys(autoRevealeExclude);

        context.subscriptions.push(
            vscode.workspace.onDidChangeWorkspaceFolders(() => {
                this.treeDataProvider.refresh();
            })
        );

        context.subscriptions.push(
            vscode.window.tabGroups.onDidChangeTabs(async () => {
                await this.revealCurrentFile(true);
            })
        );

        context.subscriptions.push(
            vscode.window.tabGroups.onDidChangeTabGroups(async () => {
                await this.revealCurrentFile(true);
            })
        );

        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration((event) => {
                if (
                    event.affectsConfiguration(
                        "talon-filetree.letterStyling"
                    ) ||
                    event.affectsConfiguration("talon-filetree.hintPosition") ||
                    event.affectsConfiguration("talon-filetree.hintSeparator")
                ) {
                    updateHintSettings();
                    this.treeDataProvider.hintRefresh();
                }

                if (
                    event.affectsConfiguration("explorer.excludeGitIgnore") ||
                    event.affectsConfiguration("files.exclude")
                ) {
                    this.treeDataProvider.refresh();
                }

                if (event.affectsConfiguration("explorer.autoReveal")) {
                    this.autoReveal = vscode.workspace
                        .getConfiguration("explorer")
                        .get("autoReveal") as boolean;
                }
            })
        );

        this.treeView.onDidExpandElement((event) => {
            this.treeDataProvider.entryWasExpanded(event.element);
        });
        this.treeView.onDidCollapseElement(async (event) => {
            await this.treeDataProvider.entryWasCollapsed(event.element);
        });

        context.subscriptions.push(this.treeView);

        this.treeView.onDidChangeVisibility((event) => {
            if (event.visible) {
                this.revealCurrentFile(true).catch((error) => {
                    console.error(error);
                });
            }
        });

        vscode.commands.registerCommand(
            "talon-filetree.openResource",
            async (resource) =>
                this.showMessageIfError(async () => this.openResource(resource))
        );
        vscode.commands.registerCommand(
            "talon-filetree.toggleDirectoryOrOpenFile",
            async (hint) =>
                this.showMessageIfError(async () =>
                    this.toggleDirectoryOrOpenFile(hint)
                )
        );
        vscode.commands.registerCommand(
            "talon-filetree.moveFile",
            async (fromHint, toHint) =>
                this.showMessageIfError(async () =>
                    this.moveFile(fromHint, toHint)
                )
        );
        vscode.commands.registerCommand(
            "talon-filetree.openFile",
            async (hint) =>
                this.showMessageIfError(async () => this.openFile(hint))
        );
        vscode.commands.registerCommand(
            "talon-filetree.renameFile",
            async (hint) =>
                this.showMessageIfError(async () => this.renameFile(hint))
        );
        vscode.commands.registerCommand(
            "talon-filetree.expandDirectory",
            async (hint, level) =>
                this.showMessageIfError(async () =>
                    this.expandDirectory(hint, level)
                )
        );
        vscode.commands.registerCommand(
            "talon-filetree.createFile",
            async (hint) =>
                this.showMessageIfError(async () => this.createFile(hint))
        );
        vscode.commands.registerCommand(
            "talon-filetree.deleteFile",
            async (hint) =>
                this.showMessageIfError(async () => this.deleteFile(hint))
        );
        vscode.commands.registerCommand(
            "talon-filetree.collapseRoot",
            async () => this.showMessageIfError(async () => this.collapseRoot())
        );
        vscode.commands.registerCommand("talon-filetree.select", async (hint) =>
            this.showMessageIfError(async () => this.select(hint))
        );
        vscode.commands.registerCommand(
            "talon-filetree.closeParent",
            async (hint) =>
                this.showMessageIfError(async () =>
                    this.closeParentDirectory(hint)
                )
        );
        vscode.commands.registerCommand(
            "talon-filetree.toggleGitIgnoredFiles",
            async () =>
                this.showMessageIfError(async () =>
                    this.toggleGitIgnoredFiles()
                )
        );
        vscode.commands.registerCommand(
            "talon-filetree.revealCurrentFile",
            async () =>
                this.showMessageIfError(async () =>
                    this.revealCurrentFile(false, true)
                )
        );
    }

    private async showMessageIfError(f: () => Promise<void>) {
        try {
            await f();
        } catch (error: any) {
            console.error(error);

            await vscode.window.showErrorMessage(
                `talon-filetree: ${error.message}`
            );
        }
    }

    async toggleGitIgnoredFiles() {
        const excludeGitIgnore = vscode.workspace
            .getConfiguration("explorer")
            .get("excludeGitIgnore") as boolean;

        await vscode.workspace
            .getConfiguration("explorer")
            .update("excludeGitIgnore", !excludeGitIgnore, true);
    }

    private async openResource(resource: vscode.Uri) {
        await vscode.commands.executeCommand("vscode.open", resource);
    }

    // This is a temporary workaround until this issue is solved:
    // https://github.com/microsoft/vscode/issues/92176
    private async collapseEntry(entry: Entry) {
        await this.treeView.reveal(entry, { focus: true });
        await vscode.commands.executeCommand("list.collapse");
        await vscode.commands.executeCommand(
            "workbench.action.focusActiveEditorGroup"
        );
    }

    private async expandToResource(uri: vscode.Uri) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);

        if (!workspaceFolder) {
            return;
        }

        const directoriesToExpand = [];
        let currentPath = path.dirname(uri.fsPath);

        while (currentPath !== workspaceFolder.uri.fsPath) {
            directoriesToExpand.push(currentPath);
            currentPath = path.dirname(currentPath);
        }

        for (const directory of directoriesToExpand.reverse()) {
            const entry = await this.treeDataProvider.getEntryFromPath(
                directory
            );
            if (entry) {
                await this.treeView.reveal(entry, { select: false, expand: 1 });
            }
        }
    }

    private async revealFile(uri: vscode.Uri, focus = false) {
        try {
            await this.expandToResource(uri);
            const entry = await this.treeDataProvider.getEntryFromPath(
                uri.fsPath
            );
            if (entry) {
                await this.treeView.reveal(entry, { focus });
            }
        } catch (error) {
            console.error(error);
        }
    }

    private async revealCurrentFile(isAutoReveal = false, focus = false) {
        if (isAutoReveal && (!this.treeView.visible || !this.autoReveal)) {
            return;
        }

        const uri = getActiveTabUri();

        if (uri) {
            if (isAutoReveal) {
                const matchesAutoRevealExclude =
                    this.autoRevealExcludeGlobPatterns
                        .map((pattern) => `${pattern}{,/**}`)
                        .some((pattern) =>
                            minimatch(uri.fsPath, pattern, {
                                dot: true
                            })
                        );

                if (matchesAutoRevealExclude) {
                    return;
                }
            }

            await this.revealFile(uri, focus);
        }
    }

    private async toggleDirectoryOrOpenFile(hint: string) {
        const entry = this.treeDataProvider.getEntryFromHint(hint);

        if (!entry.isFolder) {
            await vscode.commands.executeCommand(
                "vscode.open",
                entry.resourceUri
            );
            await this.treeView.reveal(entry);
        } else if (
            entry.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed
        ) {
            await this.treeView.reveal(entry, { expand: 1 });
        } else {
            await this.collapseEntry(entry);
        }
    }

    private async closeParentDirectory(hint: string) {
        const entry = this.treeDataProvider.getEntryFromHint(hint);

        if (entry.parent) {
            await this.collapseEntry(entry.parent);
        }
    }

    private async expandDirectory(hint: string, level: number) {
        const entry = this.treeDataProvider.getEntryFromHint(hint);
        this.treeDataProvider.preExpandToLevel(entry, level);

        if (level === 0) {
            await this.collapseEntry(entry);
            this.treeDataProvider.refresh(entry.parent);
            return;
        }

        const directoriesToExpand = await getDescendantFolders(
            entry.resourceUri,
            level - 1
        );
        this.treeDataProvider.addFoldersToExpand(directoriesToExpand);

        // This is necessary in case the target entry is collapsed
        await this.treeView.reveal(entry, { expand: 1 });

        this.treeDataProvider.refresh(entry);
    }

    private async collapseRoot() {
        // We need to get any entry to be able to use "list.collapseAll"
        const entry = this.treeDataProvider.getEntryFromHint("a");

        if (entry) {
            await this.treeView.reveal(entry, { focus: true });
            await vscode.commands.executeCommand("list.collapseAll");
            await vscode.commands.executeCommand(
                "workbench.action.focusActiveEditorGroup"
            );
        }

        this.treeDataProvider.postCollapseRoot();
    }

    private async openFile(hint: string) {
        const entry = this.treeDataProvider.getEntryFromHint(hint);

        if (entry.isFolder) {
            await this.treeView.reveal(entry, { expand: true });
        } else {
            await this.openResource(entry.resourceUri);
            await this.treeView.reveal(entry);
        }
    }

    private async renameFile(hint: string) {
        const entry = this.treeDataProvider.getEntryFromHint(hint);
        await this.treeView.reveal(entry);

        await vscode.commands.executeCommand(
            "fileutils.renameFile",
            vscode.Uri.file(entry.resourceUri.fsPath)
        );

        this.treeDataProvider.refresh(entry.parent);
    }

    private async moveFile(fromHint: string, toHint: string | undefined) {
        const fromEntry = await this.treeDataProvider.getEntryFromHint(
            fromHint
        );
        const toEntry = toHint
            ? await this.treeDataProvider.getEntryFromHint(toHint)
            : undefined;

        // We first select the entry to move for visual feedback
        await this.treeView.reveal(fromEntry);
        await sleep(100);

        const previousPath = fromEntry.resourceUri.fsPath;
        const fileName = path.basename(previousPath);

        // We are sure workspaceFolder will be defined as only entries within a
        // workspace have hints and if the hint doesn't have an associated entry
        // we throw an exception in getEntryFromHint
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(
            fromEntry.resourceUri
        )!;

        let newUri: vscode.Uri;

        if (toEntry?.isFolder) {
            newUri = vscode.Uri.joinPath(toEntry.resourceUri, fileName);
        } else if (!toEntry || !toEntry.parent) {
            newUri = vscode.Uri.joinPath(workspaceFolder.uri, fileName);
        } else {
            newUri = vscode.Uri.joinPath(toEntry.parent!.resourceUri, fileName);
        }

        if (await exists(newUri)) {
            throw new Error(
                "File or folder with the same name in the destination folder"
            );
        }

        await vscode.workspace.fs.rename(fromEntry.resourceUri, newUri);

        await this.expandToResource(newUri);
        const newEntry = await this.treeDataProvider.getEntryFromPath(
            newUri.fsPath
        );

        if (newEntry) {
            await this.treeView.reveal(newEntry);
        }
    }

    private async createFile(hint: string) {
        const entry = this.treeDataProvider.getEntryFromHint(hint);

        const directoryUri = entry.isFolder
            ? entry.resourceUri
            : vscode.Uri.file(path.dirname(entry.resourceUri.fsPath));

        const directoryEntry = await this.treeDataProvider.getEntryFromPath(
            directoryUri.fsPath
        );
        if (directoryEntry) {
            await this.treeView.reveal(directoryEntry);
        }

        const filename = await vscode.window.showInputBox({
            prompt: `Creating file in directory "${path.basename(
                directoryUri.fsPath
            )}". Enter file name! End the file name with a slash to create a folder.`
        });

        if (!filename) {
            return;
        }

        if (filename.endsWith("/")) {
            const folderName = filename.slice(0, -1);
            const dirUri = vscode.Uri.joinPath(directoryUri, folderName);

            if (await exists(dirUri)) {
                throw new Error("Folder already exists!");
            }

            await vscode.workspace.fs.createDirectory(dirUri);
        } else {
            const fileUri = vscode.Uri.joinPath(directoryUri, filename);

            if (await exists(fileUri)) {
                throw new Error("File already exists!");
            }

            await vscode.workspace.fs.writeFile(fileUri, new Uint8Array());
            await this.openResource(fileUri);
        }
    }

    private async select(hint: string) {
        const entry = this.treeDataProvider.getEntryFromHint(hint);
        await this.treeView.reveal(entry, { focus: true });
    }

    private async deleteFile(hint: string): Promise<void> {
        const entry = this.treeDataProvider.getEntryFromHint(hint);
        await this.treeView.reveal(entry);

        const selection = await vscode.window.showInformationMessage(
            `Are you sure you want to delete ${entry.resourceUri.fsPath}?`,
            { modal: true },
            "Yes",
            "No"
        );

        if (selection === "Yes") {
            await vscode.workspace.fs.delete(entry.resourceUri, {
                recursive: true,
                useTrash: true
            });
        }
    }
}
