# talon-filetree

A [vscode extension](https://marketplace.visualstudio.com/items?itemName=PaulSchaaf.talon-filetree) for navigating and manipulating the file tree quickly by voice.
Creates a new file tree view that can be used with voice commands.

## Requirements

- a voice engine. I use [talon](https://talonvoice.com/).
- the [example talon file](./tree.talon) relies on a talon vscode command client whose `vscode` function can handle multiple arguments. I use [this one](https://github.com/pokey/talon-vscode-command-client).
- the example talon file requires the `user.letters` and `number` captures (included by default in knausj). 

## Features

- Expand and collapse directories
- Expand multiple levels of a directory in one command
- Move files across directories
- Open files
- Rename files
- Create files
- Delete files
- Select files (useful for scrolling through file tree using keys and centering files in tree view)

## Talon Setup

- an example talon file can be found [here](./tree.talon)
  
## Known Issues

- None Currently
