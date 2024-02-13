# talon-filetree

A [vscode extension](https://marketplace.visualstudio.com/items?itemName=PaulSchaaf.talon-filetree) for navigating and manipulating the file tree quickly by voice.
Creates a new file tree view that can be used with voice commands.

## Requirements

- A voice engine. I use [talon](https://talonvoice.com/).
- A talon vscode command client (included by default in knausj).
- The example talon file requires the `user.letters` and `number` captures (included by default in knausj).

## Features

- Expand and collapse directories
- Expand multiple levels of a directory in one command
- Move files across directories
- Open files
- Rename files
- Create files
- Delete files
- Select files (useful for scrolling through file tree using keys and centering files in tree view)
- Finding files in folder

## Settings

### Extension Settings

- `talon-filetree.letterStyling`: Select the style of the hints between `lowercase`, `uppercase` or `emoji`.
- `talon-filetree.hintPosition`: You can select to place the hints to the left or the right of the file name.
- `talon-filetree.hintSeparator`: Select the symbols to separate the hint from the file name (only applies when hints are positioned to the left).

### Other Settings

Apart from the settings declared by this extension there are other settings that affect its behavior:

- `files.exclude`: Configure glob patterns for excluding files and folders.
- `files.enableTrash`: Moves files/folders to the OS trash (recycle bin on Windows) when deleting. Disabling this will delete files/folders permanently.
- `explorer.confirmDelete`: Controls whether the extension should ask for confirmation when deleting a file via the trash.
- `explorer.excludeGitIgnore`: Controls if git ignored files should be shown. This setting can also be toggled using the command `tree git`.
- `explorer.autoReveal`: Controls whether the extension should automatically reveal and select files when opening or focusing them. Bear in mind that only `true` or `false` values are possible, the option `focusNoScroll` will have the same effect as `true`.
- `explorer.autoRevealExclude`: Configure glob patterns for excluding files and folders from being revealed and selected when they are opened or focused.

## Talon Setup

- An example talon file can be found and cloned from [here](https://github.com/paul-schaaf/talon-filetree-commands)

## Known Issues

- None currently
