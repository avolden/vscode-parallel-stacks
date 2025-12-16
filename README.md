# Thread Graph

The extensions adds a window to display a thread graph of the currently debugged program (also known as [Parallel Stacks](https://learn.microsoft.com/en-us/visualstudio/debugger/using-the-parallel-stacks-window?view=visualstudio) in Visual Studio)

## Features

Display the thread graph.
Button to toggle external code display or not.

## Known Issues

- Hiding external code also hides parent nodes containing only external code
- Nodes with multiple threads cannot show the treads IDs and their name.
- Showing the window for the first time while a debug session is active prevent the window from correctly respond to debug events (see microsoft/vscode#282807)

## Roadmap

- [ ] Show tooltip on nodes having multiple threads
- [ ] Change active stack item in the webview (Currently impossible, see microsoft/vscode#281784)

## Release Notes

Users appreciate release notes as you update your extension.

### 0.1

Initial release of Threa Graph
