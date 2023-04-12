import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import { rimrafSync } from 'rimraf';

//#region Utilities

namespace _ {

	function handleResult<T>(resolve: (result: T) => void, reject: (error: Error) => void, error: Error | null | undefined, result: T): void {
		if (error) {
			reject(massageError(error));
		} else {
			resolve(result);
		}
	}

	function massageError(error: Error & { code?: string }): Error {
		if (error.code === 'ENOENT') {
			return vscode.FileSystemError.FileNotFound();
		}

		if (error.code === 'EISDIR') {
			return vscode.FileSystemError.FileIsADirectory();
		}

		if (error.code === 'EEXIST') {
			return vscode.FileSystemError.FileExists();
		}

		if (error.code === 'EPERM' || error.code === 'EACCESS') {
			return vscode.FileSystemError.NoPermissions();
		}

		return error;
	}

	export function checkCancellation(token: vscode.CancellationToken): void {
		if (token.isCancellationRequested) {
			throw new Error('Operation cancelled');
		}
	}

	export function normalizeNFC(items: string): string;
	export function normalizeNFC(items: string[]): string[];
	export function normalizeNFC(items: string | string[]): string | string[] {
		if (process.platform !== 'darwin') {
			return items;
		}

		if (Array.isArray(items)) {
			return items.map(item => item.normalize('NFC'));
		}

		return items.normalize('NFC');
	}

	export function readdir(path: string): Promise<string[]> {
		return new Promise<string[]>((resolve, reject) => {
			fs.readdir(path, (error, children) => handleResult(resolve, reject, error, normalizeNFC(children)));
		});
	}

	export function stat(path: string): Promise<fs.Stats> {
		return new Promise<fs.Stats>((resolve, reject) => {
			fs.stat(path, (error, stat) => handleResult(resolve, reject, error, stat));
		});
	}

	export function readfile(path: string): Promise<Buffer> {
		return new Promise<Buffer>((resolve, reject) => {
			fs.readFile(path, (error, buffer) => handleResult(resolve, reject, error, buffer));
		});
	}

	export function writefile(path: string, content: Buffer): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			fs.writeFile(path, content, error => handleResult(resolve, reject, error, void 0));
		});
	}

	export function exists(path: string): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			fs.exists(path, exists => handleResult(resolve, reject, null, exists));
		});
	}

	export function rmrf(path: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			// rimrafSync(path, error => handleResult(resolve, reject, error, void 0));
		});
	}

	export function mkdir(path: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			// mkdirp(path, error => handleResult(resolve, reject, error, void 0));
		});
	}

	export function rename(oldPath: string, newPath: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			fs.rename(oldPath, newPath, error => handleResult(resolve, reject, error, void 0));
		});
	}

	export function unlink(path: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			fs.unlink(path, error => handleResult(resolve, reject, error, void 0));
		});
	}
}

export class FileStat implements vscode.FileStat {

	constructor(private fsStat: fs.Stats) { }

	get type(): vscode.FileType {
		return this.fsStat.isFile() ? vscode.FileType.File : this.fsStat.isDirectory() ? vscode.FileType.Directory : this.fsStat.isSymbolicLink() ? vscode.FileType.SymbolicLink : vscode.FileType.Unknown;
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

interface Entry {
	uri: vscode.Uri;
	type: vscode.FileType;
    id: number;
    counter: {
        value: number
    }
}

//#endregion

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

const alphabet = "abcdefghijklmnopqrstuvwxyz";
const randomNumbers: number[] = [];
const uri_collapsibleState_map = new Map<string, vscode.TreeItemCollapsibleState>();
const id_uri_map = new Map<number, string>();
let justChanged: number | undefined = undefined;

export class FileSystemProvider implements vscode.TreeDataProvider<Entry>, vscode.FileSystemProvider {

	private _onDidChangeFile: vscode.EventEmitter<vscode.FileChangeEvent[]>;
    _onDidChangeTreeData: vscode.EventEmitter<
    Entry | undefined
  > = new vscode.EventEmitter<Entry | undefined>();

  readonly onDidChangeTreeData: vscode.Event<Entry | undefined> = this
    ._onDidChangeTreeData.event;

	constructor() {
		this._onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
        const workspaceFolder = (vscode.workspace.workspaceFolders ?? []).filter(folder => folder.uri.scheme === 'file')[0];
        if (workspaceFolder) {
            this.watch(workspaceFolder.uri, { recursive: true, excludes: [] });
        }
	}

	get onDidChangeFile(): vscode.Event<vscode.FileChangeEvent[]> {
		return this._onDidChangeFile.event;
	}

	watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
		const watcher = fs.watch(uri.fsPath, { recursive: options.recursive }, async (event: string, filename: string | Buffer) => {
			const filepath = path.join(uri.fsPath, _.normalizeNFC(filename.toString()));

            id_uri_map.clear();
			// TODO support excludes (using minimatch library?)

			this._onDidChangeFile.fire([{
				type: event === 'change' ? vscode.FileChangeType.Changed : await _.exists(filepath) ? vscode.FileChangeType.Created : vscode.FileChangeType.Deleted,
				uri: uri.with({ path: filepath })
			} as vscode.FileChangeEvent]);

            this._onDidChangeTreeData.fire(undefined);
		});

		return { dispose: () => watcher.close() };
	}

	stat(uri: vscode.Uri): vscode.FileStat | Thenable<vscode.FileStat> {
		return this._stat(uri.fsPath);
	}

	async _stat(path: string): Promise<vscode.FileStat> {
		return new FileStat(await _.stat(path));
	}

	readDirectory(uri: vscode.Uri): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
		return this._readDirectory(uri);
	}

	async _readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
		const children = await _.readdir(uri.fsPath);

		const result: [string, vscode.FileType][] = [];
		for (let i = 0; i < children.length; i++) {
			const child = children[i];
			const stat = await this._stat(path.join(uri.fsPath, child));
			result.push([child, stat.type]);
		}

		return Promise.resolve(result);
	}

	createDirectory(uri: vscode.Uri): void | Thenable<void> {
		return _.mkdir(uri.fsPath);
	}

	readFile(uri: vscode.Uri): Uint8Array | Thenable<Uint8Array> {
		return _.readfile(uri.fsPath);
	}

	writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): void | Thenable<void> {
		return this._writeFile(uri, content, options);
	}

	async _writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): Promise<void> {
		const exists = await _.exists(uri.fsPath);
		if (!exists) {
			if (!options.create) {
				throw vscode.FileSystemError.FileNotFound();
			}

			await _.mkdir(path.dirname(uri.fsPath));
		} else {
			if (!options.overwrite) {
				throw vscode.FileSystemError.FileExists();
			}
		}

		return _.writefile(uri.fsPath, content as Buffer);
	}

	delete(uri: vscode.Uri, options: { recursive: boolean; }): void | Thenable<void> {
		if (options.recursive) {
			return _.rmrf(uri.fsPath);
		}

		return _.unlink(uri.fsPath);
	}

	rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean; }): void | Thenable<void> {
		return this._rename(oldUri, newUri, options);
	}

	async _rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean; }): Promise<void> {
		const exists = await _.exists(newUri.fsPath);
		if (exists) {
			if (!options.overwrite) {
				throw vscode.FileSystemError.FileExists();
			} else {
				await _.rmrf(newUri.fsPath);
			}
		}

		const parentExists = await _.exists(path.dirname(newUri.fsPath));
		if (!parentExists) {
			await _.mkdir(path.dirname(newUri.fsPath));
		}

		return _.rename(oldUri.fsPath, newUri.fsPath);
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
                id_uri_map.set(element.counter.value, uri.path);
                return ({ uri, type, id: element.counter.value, counter: element.counter });
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
                id_uri_map.set(counter.value, uri.path);
                return ({ uri, type, id: counter.value, counter });
            });
		}

		return [];
	}

	getTreeItem(element: Entry): vscode.TreeItem {
		let treeItem = new TreeItem(element.uri, element.type === vscode.FileType.Directory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None, element.id, element);
		if (element.type === vscode.FileType.File) {
			treeItem.command = { command: 'fileExplorer.openFile', title: "Open File", arguments: [element.uri], };
			treeItem.contextValue = 'file';
		} else {
            const priorItem = uri_collapsibleState_map.get(element.uri.path);
            if (priorItem) {
                treeItem = new TreeItem(element.uri, priorItem, element.id, element);

                if (element.id === justChanged) {
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
                    justChanged = undefined;
                }
            }
        }
        uri_collapsibleState_map.set(element.uri.path, treeItem.collapsibleState!);
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
	constructor(context: vscode.ExtensionContext) {
        const provider = new FileSystemProvider()
		this.treeDataProvider = provider;
		context.subscriptions.push(vscode.window.createTreeView('filetree', { treeDataProvider: provider }));
		vscode.commands.registerCommand('fileExplorer.openFile', (resource) => this.openResource(resource));
        vscode.commands.registerCommand('talon-filetree.toggleDirectory', (letters) => this.toggleDirectory(letters));
		vscode.commands.registerCommand('talon-filetree.moveFile', (from, to) => this.moveFile(from, to));
		vscode.commands.registerCommand('talon-filetree.openFile', (letters) => this.openFile(letters));
		vscode.commands.registerCommand('talon-filetree.renameFile', (letters) => this.renameFile(letters));
	}

	private openResource(resource: vscode.Uri): void {
		vscode.window.showTextDocument(resource);
	}

    private toggleDirectory(letters: string): void {
        const itemId = lettersToNumber(letters);
		if (!itemId) {
			return;
		}
        const uri = id_uri_map.get(itemId);
        if (uri) {
            const state = uri_collapsibleState_map.get(uri);
            justChanged = itemId;
            uri_collapsibleState_map.set(uri, state === vscode.TreeItemCollapsibleState.Collapsed ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed)
            this.treeDataProvider._onDidChangeTreeData.fire(undefined);
        }
    }
	
	private openFile(letters: string): void {
		const itemId = lettersToNumber(letters);
		if (!itemId) {
			return;
		}
		const uri = id_uri_map.get(itemId);
		if (uri) {
			this.openResource(vscode.Uri.file(uri));
		}
	}

	private renameFile(letters: string): void {
		const itemId = lettersToNumber(letters);
		if (!itemId) {
			return;
		}
		const uri = id_uri_map.get(itemId);
		if (uri) {
			vscode.commands.executeCommand('fileutils.renameFile', vscode.Uri.file(uri));
		}
	}

	private moveFile(from: string, to: string | undefined): void {
		const fromId = lettersToNumber(from);
		if (!fromId) {
			return;
		}
		const fromUri = id_uri_map.get(fromId);
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
			const toUri = id_uri_map.get(toId);
			if (!toUri) {
				return;
			}
			const isCollapsible = uri_collapsibleState_map.get(toUri)! !== vscode.TreeItemCollapsibleState.None;
			let newUri;
			if (isCollapsible) {
				newUri = path.join(toUri, fileName);
			} else {
				newUri = path.join(path.dirname(toUri), fileName);
			}
			fs.renameSync(fromUri, newUri);
		}
	}
}