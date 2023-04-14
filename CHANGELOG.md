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
