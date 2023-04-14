# This opens the file tree in the sidebar
bar tree: user.vscode("workbench.view.extension.filetree")

# File tree commands
tree <user.letters>:
    user.vscode("talon-filetree.toggleDirectory", "{letters}")
tree <user.letters> <number>:
    user.vscode("talon-filetree.expandDirectory", "{letters}", "{number}")
tree <user.letters> collapse:
    user.vscode("talon-filetree.expandDirectory", "{letters}", "0")
tree move <user.letters> to <user.letters>:
    user.vscode("talon-filetree.moveFile", "{letters_1}", "{letters_2}")
tree move <user.letters> [to] root:
    user.vscode("talon-filetree.moveFile", "{letters_1}")
tree open <user.letters>:
    user.vscode("talon-filetree.openFile", "{letters}")
tree rename <user.letters>: 
    user.vscode("talon-filetree.renameFile", "{letters}")
tree create <user.letters>:
    user.vscode("talon-filetree.createFile", "{letters}")
^tree delete <user.letters>$:
    user.vscode("talon-filetree.deleteFile", "{letters}")
tree root collapse:
    user.vscode("talon-filetree.collapseRoot")
tree select <user.letters>:
    user.vscode("talon-filetree.select", "{letters}")