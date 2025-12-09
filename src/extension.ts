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
}

export function deactivate() {}
