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

## Settings

### Extension Settings

-   Hints are displayed as emojis to differentiate them from file names. This can be changed in the settings.

### Other Settings

Apart from the settings declared by this extension there are other settings that affect the behavior of this extension:

-   `files.exclude`: This setting defines glob patterns for excluding files and folders.
-   `explorer.excludeGitIgnore`: This setting is used to determine if git ignored files should be shown. This setting can also be toggled using the command `tree git`.

## Talon Setup

-   an example talon file can be found [here](./tree.talon)

## Known Issues

-   None currently
