## 0.6.9 [2024-02-13]

- add "Find in Folder" functionality (remember to pull from [talon-commands repo](https://github.com/paul-schaaf/talon-filetree-commands)) (thanks to [PR](https://github.com/paul-schaaf/talon-filetree/pull/39) by [david-tejada](https://github.com/david-tejada))
- remove all commands from command palette

## 0.6.8 [2024-02-10]
- Improve deletion messages so they match the native explorer ones (thanks to [PR](https://github.com/paul-schaaf/talon-filetree/pull/38) by [david-tejada](https://github.com/david-tejada))

## 0.6.7 [2024-02-03]
- Fix unnecessary reveals of files (thanks to PRs [35](https://github.com/paul-schaaf/talon-filetree/pull/35) and [36](https://github.com/paul-schaaf/talon-filetree/pull/36) by [david-tejada](https://github.com/david-tejada))

## 0.6.6 [2024-01-08]

- Fix buggy behavior when moving files with unsaved changes (thanks to [PR](https://github.com/paul-schaaf/talon-filetree/pull/34) by [david-tejada](https://github.com/david-tejada)).
- Make undo/redo of file moves possible (thanks to [PR](https://github.com/paul-schaaf/talon-filetree/pull/34) by [david-tejada](https://github.com/david-tejada)).
- Make undo/redo of edits possible after moving files with open editors (thanks to [PR](https://github.com/paul-schaaf/talon-filetree/pull/34) by [david-tejada](https://github.com/david-tejada)).
- Show confirmation modal when target file/folder exists. Behaving the same as the native explorer (thanks to [PR](https://github.com/paul-schaaf/talon-filetree/pull/34) by [david-tejada](https://github.com/david-tejada)).

## 0.6.5 [2023-12-24]

- removes unnecessary resolve statement ([PR](https://github.com/paul-schaaf/talon-filetree/pull/33))

## 0.6.4 [2023-12-24]

- creating files is faster now (thanks to [PR](https://github.com/paul-schaaf/talon-filetree/pull/31) by [david-tejada](https://github.com/david-tejada)).

## 0.6.3 [2023-11-12]

- hints can now be displayed in front of file names (thanks to [PR](https://github.com/paul-schaaf/talon-filetree/pull/29) by [david-tejada](https://github.com/david-tejada)). This can be turned on in the settings. This feature was added so that hints are visible regardless of filename length.

## 0.6.2 [2023-06-21]

- fix bug where emoji letters wouldn't show beyond 26 items (thanks to [PR](https://github.com/paul-schaaf/talon-filetree/pull/23) by [david-tejada](https://github.com/david-tejada))
- hints are now lowercase letters by default (thanks to [PR](https://github.com/paul-schaaf/talon-filetree/pull/23) by [david-tejada](https://github.com/david-tejada))

## 0.6.1 [2023-06-11]

All changes in this release thanks to PRs by [david-tejada](https://github.com/david-tejada)

- Reveal current file on tree view visibility change
- Select directory where new file/folder will be created
- You can now delete non empty directories

## 0.6.0 [2023-06-06]

All changes in this release thanks to PR by [david-tejada](https://github.com/david-tejada)

- Support multiple workspace folders.
- Reveal active editor in the file tree when it changes.
- Stable hints. Every file or folder has an associated hint and it doesn't change even if you collapse the parent folder (only in large folders to avoid running out of one or two letter hints).
- Some settings are now configurable via existing vscode settings (see [README](./README.md)).
- Add viewsWelcome and remove error if there is no workspace folder.

**CHANGED:**
- `tree <hint> zero` now closes the tree node. All other levels are shifted by one as well.

## 0.5.13 [2023-04-20]

- fix extension failing to load when workspace is not a git repository (thanks to PR by [david-tejada](https://github.com/david-tejada))

## 0.5.12 [2023-04-19]

- `tree current` now selects and focuses the current file in the tree view (thanks to PR by [david-tejada](https://github.com/david-tejada))

## 0.5.11 [2023-04-17]

- attempt to fix bug where deletion fails on macos

## 0.5.10 [2023-04-16]

- improve cross platform file path handling

## 0.5.9 [2023-04-16]

- letters can now be displayed as emojis, lowercase, or uppercase

## 0.5.8 [2023-04-16]

- letters are now displayed as emojis. This can be turned off in the settings.

## 0.5.7 [2023-04-16]

- performance improvements

## 0.5.6 [2023-04-16]

- improve startup performance (by removing initial file watches)

## 0.5.5 [2023-04-16]

- `tree current` command that expands the tree to show the current file.

## 0.5.4 [2023-04-16]

- fix bug where expansions/collapses would have to be called twice to work if user previously used clicks to expand/collapse

## 0.5.3 [2023-04-15]

- revert bundling changes made in 0.5.2

## 0.5.2 [2023-04-15]

- deleting files now puts them in the trash so they can be recovered

## 0.5.1 [2023-04-15]

- nodes are now always shown in the following order: directories alphabetically sorted, files alphabetically sorted

## 0.5.0 [2023-04-15]

- `tree git` command that shows/hides gitignored files. They are hidden by default.

BREAKING:

- remove anchors around `tree delete` in example talon file (they prevent using the `cancel` command)

## 0.4.0 [2023-04-14]

- `closeParent` command that closes the parent directory of the selected node (useful for when you are scrolling through a large directory like node modules and no longer see the parent directory tag to close it that way)

BREAKING:

- `tree <user.letters> collapse` is now `tree collapse <user.letters>` (this is to make it consistent with the other commands)
- `tree root collapse` is now `tree collapse root` (this is to make it consistent with the other commands)
- now using `run_rpc_command` in talon example file

## 0.3.0 [2023-04-14]

- now displaying unexpected errors as error messages
- remove string interpolation from talon example file

BREAKING:

- createFile will now fail if destination exists already (this is already the case with rename)

## 0.2.0 [2023-04-14]

- `toggleDirectory` is now `toggleDirectoryOrOpenFile` and will toggle a directory or open a file, depending on the selected node
- `openFile` now shows an error message if the selected node is a directory
- `expandDirectory` now shows an error message if the selected node is a file

## 0.1.2 [2023-04-14]

- fix bug where extension could not be used on linux because it doesn't support nodejs fs.watch recursive option

## 0.1.1 [2023-04-14]

Downgraded required vscode version

## 0.1 [2023-04-14]

Initial Release
