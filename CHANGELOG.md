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
