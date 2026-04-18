import * as vscode from 'vscode';
import * as webView from './webView';

export function activate(context: vscode.ExtensionContext) {

	const callstackDisposable = vscode.commands.registerCommand('parallel-stacks.callstack-show', () => {
		webView.show(vscode.Uri.file(context.asAbsolutePath('res/main.html')), context);
	});
	context.subscriptions.push(callstackDisposable);
	const cmdDisposable = vscode.commands.registerCommand('parallel-stacks.show', () => {
		webView.show(vscode.Uri.file(context.asAbsolutePath('res/main.html')), context);
	});
	context.subscriptions.push(cmdDisposable);

	vscode.window.registerWebviewPanelSerializer('parallel-stacks', new webView.Deserializer(
		vscode.Uri.file(context.asAbsolutePath('res/main.html')),
		context
	));

	let webviewState: webView.WebViewState | undefined = context.globalState.get('webviewState');
	if (!webviewState) {
		webviewState = new webView.WebViewState();
		context.globalState.update('webviewState', webviewState);
	}

	let sessionEvent = vscode.debug.onDidChangeActiveDebugSession((session) => {
		webView.onSessionChange(session);
	});
	context.subscriptions.push(sessionEvent);
	let activeItemEvent = vscode.debug.onDidChangeActiveStackItem((item) => {
		webView.onChangeDebugItem(item);
	});
	context.subscriptions.push(activeItemEvent);

	let trackerFactory = vscode.debug.registerDebugAdapterTrackerFactory('*', {
		createDebugAdapterTracker(session: vscode.DebugSession) {
			return {
				onWillReceiveMessage: (msg) => webView.onDebugReceive(msg),
				onDidSendMessage: (msg) => webView.onDebugSend(msg)
			};
		}
	});
	context.subscriptions.push(trackerFactory);

	vscode.window.onDidChangeActiveColorTheme(() => {
		webView.onThemeChange();
	});
}

export function deactivate() { }
