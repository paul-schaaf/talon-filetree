import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as utils from './utilities';

function getDirectories(dirPath: string, level = 0) {
	let result: { path: string, level: number}[] = [];
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
	  console.error('Error reading directory:', error);
	}

	return result;
}

function numberToAlphabet(num: number) {
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    const length = alphabet.length;
    let result = '';

    while (num > 0) {
      num--; // Adjust the number to a zero-based index
      const index = num % length;
      result = alphabet[index] + result;
      num = Math.floor(num / length);
    }

    return result;
}

function lettersToNumber(letters: string) {
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


interface Entry {
	uri: vscode.Uri;
	type: vscode.FileType;
    id: number;
    counter: {
        value: number
    };
	parent: Entry | undefined;
}

const randomNumbers: number[] = [];
const uriCollapsibleStateMap = new Map<string, vscode.TreeItemCollapsibleState>();
const idUriMap = new Map<number, string>();
const uriIdMap = new Map<string, number>();
const idEntryMap = new Map<number, Entry>();

export class FileSystemProvider implements vscode.TreeDataProvider<Entry> {

    private readonly _onDidChangeTreeData: vscode.EventEmitter<Entry | undefined> = new vscode.EventEmitter<Entry | undefined>();
	readonly onDidChangeTreeData: vscode.Event<Entry | undefined> = this._onDidChangeTreeData.event;

	constructor() {
        const workspaceFolder = (vscode.workspace.workspaceFolders ?? []).filter(folder => folder.uri.scheme === 'file')[0];
        if (workspaceFolder) {
            this.watch(workspaceFolder.uri, { recursive: true, excludes: [] });
        }
	}

	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
		const watcher = fs.watch(uri.fsPath, { recursive: options.recursive }, async () => {

            idUriMap.clear();
			uriIdMap.clear();
			idEntryMap.clear();

            this.refresh();
		});

		return { dispose: () => watcher.close() };
	}

	readDirectory(uri: vscode.Uri): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
		return this._readDirectory(uri);
	}

	async _readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
		const children = await utils.readdir(uri.fsPath);

		const result: [string, vscode.FileType][] = [];
		for (let i = 0; i < children.length; i++) {
			const child = children[i];
			const stat = new utils.FileStat(await utils.stat(path.join(uri.fsPath, child)));
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
                const uri = vscode.Uri.file(path.join(element.uri.fsPath, name));
                idUriMap.set(element.counter.value, uri.path);
				uriIdMap.set(uri.path, element.counter.value);
                return ({ uri, type, id: element.counter.value, counter: element.counter, parent: element });
            });
		}

        const counter = { value: 0 };

		const workspaceFolder = (vscode.workspace.workspaceFolders ?? []).filter(folder => folder.uri.scheme === 'file')[0];
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
                const uri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, name));
                idUriMap.set(counter.value, uri.path);
				uriIdMap.set(uri.path, counter.value);
                return ({ uri, type, id: counter.value, counter, parent: undefined });
            });
		}

		return [];
	}

	getParent(element: Entry): vscode.ProviderResult<Entry> {
		return element.parent;
	}

	getTreeItem(element: Entry): vscode.TreeItem {
		let treeItem = new TreeItem(element.uri, element.type === vscode.FileType.Directory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None, element.id, element);
		if (element.type === vscode.FileType.File) {
			treeItem.command = { command: 'fileExplorer.openFile', title: "Open File", arguments: [element.uri], };
			treeItem.contextValue = 'file';
		} else {
            const priorItem = uriCollapsibleStateMap.get(element.uri.path);
            if (priorItem) {
                treeItem = new TreeItem(element.uri, priorItem, element.id, element);
				let randomNumber;
				while (true) {
					randomNumber = Math.random();
					if (randomNumbers.includes(randomNumber)) {
						continue;
					}
					randomNumbers.push(randomNumber);
					const index = randomNumbers.indexOf(element.id, 0);
					if (index > -1) {
						randomNumbers.splice(index, 1);
					}
					break;
				}
				treeItem.id = randomNumber.toString();
            }
        }
        idEntryMap.set(element.id, element);
        uriCollapsibleStateMap.set(element.uri.path, treeItem.collapsibleState!);
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
        const provider = new FileSystemProvider()
		this.treeDataProvider = provider;
		this.treeView = vscode.window.createTreeView('filetree', { treeDataProvider: provider })
		context.subscriptions.push(this.treeView);
		vscode.commands.registerCommand('fileExplorer.openFile', (resource) => this.openResource(resource));
        vscode.commands.registerCommand('talon-filetree.toggleDirectory', (letters) => this.toggleDirectory(letters));
		vscode.commands.registerCommand('talon-filetree.moveFile', (from, to) => this.moveFile(from, to));
		vscode.commands.registerCommand('talon-filetree.openFile', (letters) => this.openFile(letters));
		vscode.commands.registerCommand('talon-filetree.renameFile', (letters) => this.renameFile(letters));
		vscode.commands.registerCommand('talon-filetree.expandDirectory', (letters, level) => this.expandDirectory(letters, level));
		vscode.commands.registerCommand('talon-filetree.createFile', (letters) => this.createFile(letters));
		vscode.commands.registerCommand('talon-filetree.deleteFile', (letters) => this.deleteFile(letters));
		vscode.commands.registerCommand('talon-filetree.collapseRoot', () => this.collapseRoot());
		vscode.commands.registerCommand('talon-filetree.select', (letters) => this.select(letters));
	}

	private openResource(resource: vscode.Uri): void {
		vscode.window.showTextDocument(resource);
	}

    private toggleDirectory(letters: string): void {
        const itemId = lettersToNumber(letters);
		if (itemId === undefined) {
			return;
		}
        const uri = idUriMap.get(itemId);
        if (uri) {
            const state = uriCollapsibleStateMap.get(uri);
            uriCollapsibleStateMap.set(uri, state === vscode.TreeItemCollapsibleState.Collapsed ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed)
            this.treeDataProvider.refresh();
        }
    }

	private expandDirectory(letters: string, levelString: string): void {
		const itemId = lettersToNumber(letters);
		if (itemId === undefined) {
			return;
		}
        const uri = idUriMap.get(itemId);
		const level = parseInt(levelString)
		if (uri) {
			if (uriCollapsibleStateMap.get(uri) !== vscode.TreeItemCollapsibleState.Expanded) {
				uriCollapsibleStateMap.set(uri, vscode.TreeItemCollapsibleState.Expanded)
			}
			for (const directory of getDirectories(uri)) {
				if (directory.level >= level) {
					uriCollapsibleStateMap.set(directory.path, vscode.TreeItemCollapsibleState.Collapsed)
				} else if (uriCollapsibleStateMap.get(directory.path) !== vscode.TreeItemCollapsibleState.Expanded) {
					uriCollapsibleStateMap.set(directory.path, vscode.TreeItemCollapsibleState.Expanded)
				}
			}
			this.treeDataProvider.refresh();
		}
	}

	private collapseRoot(): void {
		const workspacePath = vscode.workspace.workspaceFolders![0].uri.path;
		for (const directory of getDirectories(workspacePath)) {
			if (directory.level === 0) {
				uriCollapsibleStateMap.set(directory.path, vscode.TreeItemCollapsibleState.Collapsed)
			}
		}
		this.treeDataProvider.refresh();
	}

	private openFile(letters: string): void {
		const itemId = lettersToNumber(letters);
		if (!itemId) {
			return;
		}
		const uri = idUriMap.get(itemId);
		if (uri) {
			this.openResource(vscode.Uri.file(uri));
		}
	}

	private renameFile(letters: string): void {
		const itemId = lettersToNumber(letters);
		if (!itemId) {
			return;
		}
		const uri = idUriMap.get(itemId);
		if (uri) {
			vscode.commands.executeCommand('fileutils.renameFile', vscode.Uri.file(uri));
		}
	}

	private moveFile(from: string, to: string | undefined): void {
		const fromId = lettersToNumber(from);
		if (!fromId) {
			return;
		}
		const fromUri = idUriMap.get(fromId);
		if (fromUri === undefined) {
			return;
		}
		const fileName = path.basename(fromUri);
		if (to === undefined) {
			// move to workspace root
			const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fromUri));
			if (workspaceFolder) {
				const newUri = path.join(workspaceFolder.uri.fsPath, fileName);
				fs.renameSync(fromUri, newUri);
			}
		} else {
			const toId = lettersToNumber(to);
			if (!toId) {
				return;
			}
			const toUri = idUriMap.get(toId);
			if (!toUri) {
				return;
			}
			const isCollapsible = uriCollapsibleStateMap.get(toUri)! !== vscode.TreeItemCollapsibleState.None;
			let newUri;
			if (isCollapsible) {
				newUri = path.join(toUri, fileName);
			} else {
				newUri = path.join(path.dirname(toUri), fileName);
			}
			fs.renameSync(fromUri, newUri);
		}
	}

	private createFile(letters: string): void {
		const itemId = lettersToNumber(letters);
		if (!itemId) {
			return;
		}
		const uri = idUriMap.get(itemId);
		if (uri) {
			const isCollapsible = uriCollapsibleStateMap.get(uri)! !== vscode.TreeItemCollapsibleState.None;
			let directoryPath: string;
			if (isCollapsible) {
				directoryPath = uri;
			} else {
				directoryPath = path.dirname(uri);
			}
			vscode.window.showInputBox({ prompt: `Creating file in directory ${path.basename(directoryPath)}. Enter file name! End the file name with a slash to create a folder.` }).then((fileName) => {
				if (fileName) {
					if (fileName[fileName.length - 1] !== "/") {
						let filePath = path.join(directoryPath, fileName);
						fs.writeFileSync(filePath, '');
						this.openResource(vscode.Uri.file(filePath));
					} else {
						const result = fileName.substring(0, fileName.length - 1);
						let dirPath = path.join(directoryPath, result);
						fs.mkdirSync(dirPath);
						uriCollapsibleStateMap.set(dirPath, vscode.TreeItemCollapsibleState.Expanded);
						this.treeDataProvider.refresh();
					}
				}
			})
		}
	}

	private select(letters: string): void {
		const itemId = lettersToNumber(letters);
		if (!itemId) {
			return;
		}
		const entry = idEntryMap.get(itemId)!;
		this.treeView.reveal(entry, { focus: true });
	}

	private deleteFile(letters: string): void {
		const itemId = lettersToNumber(letters);
		if (!itemId) {
			return;
		}
		const uri = idUriMap.get(itemId);
		if (!uri) {
			return;
		}
		vscode.window.showInformationMessage(
			`Are you sure you want to delete ${uri}?`,
			{ modal: true },
			'Yes',
			'No'
		).then((selection) => {
			if (selection === 'Yes') {
				const isCollapsible = uriCollapsibleStateMap.get(uri)! !== vscode.TreeItemCollapsibleState.None;

				if (isCollapsible) {
					fs.rmdirSync(uri, { recursive: true });
				} else {
					fs.unlinkSync(uri);
				}
				uriCollapsibleStateMap.delete(uri);
				this.treeDataProvider.refresh();
			}
		});
	}
}