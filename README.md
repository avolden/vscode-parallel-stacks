# Thread Graph

The extensions adds a window to display a thread graph of the currently debugged program (also known as [Parallel Stacks](https://learn.microsoft.com/en-us/visualstudio/debugger/using-the-parallel-stacks-window?view=visualstudio) in Visual Studio)

## Features

Display the thread graph.
Button to toggle external code display or not.

TODO info to open webview

## Known Issues

- Hiding external code also hides parent nodes containing only external code
- Nodes with multiple threads cannot show the treads IDs and their name.
- Showing the window for the first time while a debug session is active prevent the window from correctly respond to debug events (see microsoft/vscode#282807)

## Roadmap/TODO list

- [ ] Show tooltip on nodes having multiple threads
- [ ] Change active stack item in the webview (Currently impossible, see microsoft/vscode#281784)
- [ ] Display a text when the view is opened and the debugger is not paused
- [ ] Improve node link rendering
