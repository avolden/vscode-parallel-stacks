import * as vscode from 'vscode';
import { createThreadTree, findNode, Node, Frame } from './nodeTree';

let currentPanel: vscode.WebviewPanel | undefined = undefined;
let currentSession: vscode.DebugSession | undefined = undefined;

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
	async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: unknown): Promise<void> {
		currentPanel = webviewPanel;

		initWebview(this.html, this.context);
	}
}

async function initWebview(html: vscode.Uri, context: vscode.ExtensionContext) {
	if (currentPanel === undefined) {
		return;
	}

	const data = (await vscode.workspace.fs.readFile(html)).toString();

	let webview: vscode.Webview = currentPanel.webview;
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'res', 'main.js'));
	const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'res', 'reset.css'));
	const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'res', 'main.css'));
	const nonce = getNonce();

	let webviewState: WebViewState | undefined = context.globalState.get('webviewState');
	let externalCode = '';
	if (webviewState?.external) {
		externalCode = 'class="toggle"';
	}

	let formattedData = eval('`' + data + '`');
	currentPanel.webview.html = formattedData;

	currentPanel.onDidDispose(() => {
		currentPanel = undefined;
	});

	currentPanel.webview.onDidReceiveMessage(async msg => {
		switch (msg.command) {
			case 'update':
				// HACK, onDidChangeActiveDebugSession is sometimes not triggering for the 1st launch
				if (!currentSession && vscode.debug.activeDebugSession) {
					currentSession = vscode.debug.activeDebugSession;
				}
				if (currentSession) {
					let root: Node | undefined = await createThreadTree(currentSession);

					if (root) {
						let msg = {
							command: 'threads',
							threads: root
						};
						if (currentPanel) { currentPanel.webview.postMessage(msg); }

						onChangeDebugItem(vscode.debug.activeStackItem);
					}
					else {
						let msg = {
							command: 'continue'
						};
						if (currentPanel) { currentPanel.webview.postMessage(msg); }
					}
				}
				break;
			case 'updateState':
				context.globalState.update('webviewState', msg.data);
				break;
			case 'open':
				let node: Node = msg.node;
				if (node) {
					let func: Frame = node.frames[node.frames.length - 1 - msg.func];
					let uri: vscode.Uri = vscode.Uri.file(func.source);
					for (const tabGroup of vscode.window.tabGroups.all) {
						for (const tab of tabGroup.tabs) {
							if (tab.input instanceof vscode.TabInputText &&
								tab.input.uri.toString() === uri.toString()) {
								// Focus that group and open the doc there
								vscode.window.showTextDocument(uri, {
									viewColumn: tabGroup.viewColumn,
									preserveFocus: false,
									preview: false,
								}).then(editor => {
									let range = editor.document.lineAt(func.line - 1).range;
									editor.revealRange(range);
									editor.selection = new vscode.Selection(range.start, range.start);
								});
								return;
							}
						}
					}

					vscode.window.showTextDocument(uri).then(editor => {
						let range = editor.document.lineAt(func.line - 1).range;
						editor.revealRange(range);
						editor.selection = new vscode.Selection(range.start, range.start);
					});
				}
				break;
		}
	});
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

function open(threadID: number, func: number) {

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

		initWebview(html, context);
		currentPanel.reveal(vscode.ViewColumn.Active);
	}
}

export async function onSessionChange(session: vscode.DebugSession | undefined) {
	currentSession = session;
	if (currentSession) {
		try {
			let root: Node | undefined = await createThreadTree(currentSession);

			if (root) {
				let msg = {
					command: 'threads',
					threads: root
				};
				if (currentPanel) { currentPanel.webview.postMessage(msg); }
				onChangeDebugItem(vscode.debug.activeStackItem);
			}
			else {
				let msg = {
					command: 'continue'
				};
				if (currentPanel) { currentPanel.webview.postMessage(msg); }
			}
		} catch (error) {

		}
	}
}

export async function onDebugReceive(msg: any) {
	switch (msg.command) {
		case 'continue':
		case 'initialize':
		case 'disconnect':
			let postMsg = {
				command: msg.command
			};
			if (currentPanel) {
				currentPanel.webview.postMessage(postMsg);
			}
			break;
	}
}

export async function onDebugSend(msg: any) {
	if (msg.event === 'stopped') {
		// HACK, onDidChangeActiveDebugSession is sometimes not triggering for the 1st launch
		if (!currentSession && vscode.debug.activeDebugSession) {
			currentSession = vscode.debug.activeDebugSession;
		}
		if (currentSession) {
			let root: Node | undefined = await createThreadTree(currentSession);

			let msg = {
				command: 'threads',
				threads: root
			};
			if (currentPanel) { currentPanel.webview.postMessage(msg); }
			onChangeDebugItem(vscode.debug.activeStackItem);
		}
	}
}

export function onThemeChange() {
	let msg = {
		command: 'theme'
	};
	if (currentPanel) { currentPanel.webview.postMessage(msg); }
}

export function registerSession(session: vscode.DebugSession) {

}

export async function onChangeDebugItem(item: vscode.DebugThread | vscode.DebugStackFrame | undefined) {
	if (item && item.session === currentSession) {
		let msg = {
			command: 'activeItem',
			threadID: item.threadId,
			frameID: -1
		};
		if (item instanceof vscode.DebugStackFrame) {
			msg.frameID = item.frameId;
		}
		if (currentPanel) { currentPanel.webview.postMessage(msg); }
	}
}