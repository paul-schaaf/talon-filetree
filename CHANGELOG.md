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
