import * as vscode from 'vscode';
import * as web_view from './web_view'
import { vibe_activate } from './vibe';

export function activate(context: vscode.ExtensionContext) {

	const callstackDisposable = vscode.commands.registerCommand('thread-graph.callstack-show', () => {
		web_view.show(vscode.Uri.file(context.asAbsolutePath('res/main.html')), context);
	});
	context.subscriptions.push(callstackDisposable);
	const cmdDisposable = vscode.commands.registerCommand('thread-graph.show', () => {
		web_view.show(vscode.Uri.file(context.asAbsolutePath('res/main.html')), context);
	});
	context.subscriptions.push(cmdDisposable);

	vscode.window.registerWebviewPanelSerializer('thread-graph', new web_view.Deserializer(
		vscode.Uri.file(context.asAbsolutePath('res/main.html')),
		context
	));

	let webviewState: web_view.WebViewState | undefined = context.globalState.get('webviewState');
	if (!webviewState) {
		webviewState = new web_view.WebViewState();
		context.globalState.update('webviewState', webviewState);
	}

	let sessionEvent = vscode.debug.onDidChangeActiveDebugSession((session) => {
		web_view.onSessionChange(session);
	});

	context.subscriptions.push(sessionEvent);

	let trackerFactory = vscode.debug.registerDebugAdapterTrackerFactory('*', {
		createDebugAdapterTracker(session: vscode.DebugSession) {
			return {
				onWillReceiveMessage: (msg) => web_view.onDebugReceive(msg),
				onDidSendMessage: (msg) => web_view.onDebugSend(msg)
			};
		}
	});
	context.subscriptions.push(trackerFactory);

	vscode.window.onDidChangeActiveColorTheme(() => {
		web_view.onThemeChange();
	})
}

export function deactivate() {}
