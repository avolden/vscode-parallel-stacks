# Thread Graph

The extensions adds a window to display a thread graph of the currently debugged program (also known as [Parallel Stacks](https://learn.microsoft.com/en-us/visualstudio/debugger/using-the-parallel-stacks-window?view=visualstudio) in Visual Studio).

![screenshot](doc/screenshot_full.png)
Example of the thread graph view.

## Features

The view displays a graph of threads grouped by callstacks, when the program is paused.

- **Compatible with all debuggers**: The view use custom Debug Adapter Protocol requests to retrieve information. All debugger implementing the protocol should work.
- **Sync with editor**: Navigating in the callstack or stepping in the code updates automatically the view.
- **Show external code**: Hide code created by third party (such as closed source libraries) to focus on debugging your code.
- **Navigate from the view**: Clicking on a function will open the file and go to the function line (if the file exists locally).

The view is accessible either by using the `Thread Graph: Show` command, either by clicking the icon added in the callstack menu bar.
![alt text](doc/callstack_menu_bar.png)
