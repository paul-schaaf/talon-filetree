# talon-filetree

A [vscode extension](https://marketplace.visualstudio.com/items?itemName=PaulSchaaf.talon-filetree) for navigating and manipulating the file tree quickly by voice.
Creates a new file tree view that can be used with voice commands.

## Requirements

-   a voice engine. I use [talon](https://talonvoice.com/).
-   a talon vscode command client (included by default in knausj).
-   the example talon file requires the `user.letters` and `number` captures (included by default in knausj).

## Features

-   Expand and collapse directories
-   Expand multiple levels of a directory in one command
-   Move files across directories
-   Open files
-   Rename files
-   Create files
-   Delete files
-   Select files (useful for scrolling through file tree using keys and centering files in tree view)

## Talon Setup

-   an example talon file can be found [here](./tree.talon)

## Known Issues

-   if you manually expand and collapse directories (i.e. by clicking instead of using the provided commands), the extension will currently still think that the directory is in the old expanded/collapsed state. Thus, next time you want to expand/collapse the directory, you will have to do it twice.
