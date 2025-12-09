import * as vscode from 'vscode';
import { createThreadTree, Node } from './node_tree'; 

let currentPanel: vscode.WebviewPanel | undefined = undefined;

export class WebViewState {
	external: boolean = true;
}

export class Deserializer implements vscode.WebviewPanelSerializer {
	html: vscode.Uri;
	context: vscode.ExtensionContext;
	constructor(html: vscode.Uri, context: vscode.ExtensionContext) {
		this.html = html;
		this.context = context;
	}
	async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: unknown): Promise<void> {console.log(state);
		const data = (await vscode.workspace.fs.readFile(this.html)).toString();

		let webview: vscode.Webview = webviewPanel.webview;
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'res', 'main.js'));
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'res', 'reset.css'));
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'res', 'main.css'));
		const nonce = getNonce();

		let webviewState: WebViewState | undefined = this.context.globalState.get('webviewState');
		const externalCode = webviewState?.external || '';

		let formattedData = eval('`'+data+'`');
		webviewPanel.webview.html = formattedData;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

export async function show(html: vscode.Uri, context: vscode.ExtensionContext) {
	if (currentPanel) {
		currentPanel.reveal(vscode.ViewColumn.Active);
	}
	else {
		currentPanel = vscode.window.createWebviewPanel('thread-graph', 'Thread Graph', vscode.ViewColumn.Active, {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'res')]
		});

		const data = (await vscode.workspace.fs.readFile(html)).toString();

		let webview: vscode.Webview = currentPanel.webview;
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'res', 'main.js'));
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'res', 'reset.css'));
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'res', 'main.css'));
		const nonce = getNonce();

		let webviewState: WebViewState | undefined = context.globalState.get('webviewState');
		let externalCode = '';
		if (webviewState?.external) {
			externalCode = 'checked';
		}

		let formattedData = eval('`'+data+'`');
		currentPanel.webview.html = formattedData;

		currentPanel.onDidDispose(() => {
			currentPanel = undefined;
		});

		currentPanel.webview.onDidReceiveMessage(async msg => {
			switch (msg.command) {
				case 'update':
					let debugSession = vscode.debug.activeDebugSession;
					if (debugSession) {
						let root: Node = await createThreadTree(debugSession);
						console.log(root);

						if (debugSession.type == 'cppvsdbg' || debugSession.type == 'cppdbg') {
							console.log('MS Debugger')
						}

						let msg = {
							command: 'threads',
							threads: root
						};
						if (currentPanel)
							currentPanel.webview.postMessage(msg);
					}
					break;
				case 'updateState':
					context.globalState.update('webviewState', msg.data);
					break;
			}
		});
		currentPanel.reveal(vscode.ViewColumn.Active);
	}
}