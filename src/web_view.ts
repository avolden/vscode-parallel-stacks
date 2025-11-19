import * as vscode from 'vscode';

class Thread {
	id: number = 0;
	frames: {
		fn: string;
		// file: string;
		// line: number;
	}[] = [];
}

let currentPanel: vscode.WebviewPanel | undefined = undefined;

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

function _getHtmlForWebview(webview: vscode.Webview, extUri: vscode.Uri, catGifPath: string) {
		// And the uri we use to load this script in the webview
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extUri, 'res', 'main.js'));
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(extUri, 'res', 'reset.css'));
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extUri, 'res', 'main.css'));

		// Use a nonce to only allow specific scripts to be run
		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" type="text/css" rel="stylesheet">
				<link href="${styleUri}" type="text/css" rel="stylesheet">

				<title>Thread Graph</title>
			</head>
			<body>
				<img src="${catGifPath}" width="300" />
				<div id="lines-of-code-counter" class="ababa">0</h1>

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}

export async function show(html: vscode.Uri, extUri: vscode.Uri) {
	if (currentPanel) {
		currentPanel.reveal(vscode.ViewColumn.Active);
		let msg = {
			command: 'threads',
			threads: [
				'ababa',
				'Hello',
				'World'
			]
		};
		currentPanel.webview.postMessage(msg);
	}
	else {
		currentPanel = vscode.window.createWebviewPanel('thread-graph', 'Thread Graph', vscode.ViewColumn.Active, {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(extUri, 'res')]
		});

		const data = (await vscode.workspace.fs.readFile(html)).toString();

		let webview: vscode.Webview = currentPanel.webview;
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extUri, 'res', 'main.js'));
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(extUri, 'res', 'reset.css'));
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extUri, 'res', 'main.css'));
		const nonce = getNonce();

		// let formattedData = _getHtmlForWebview(webview, extUri, 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif');
		let formattedData = eval('`'+data+'`');

		// console.log(formattedData);
		currentPanel.webview.html = formattedData;

		currentPanel.onDidDispose(() => {
			currentPanel = undefined;
		});

		currentPanel.webview.onDidReceiveMessage(async msg => {
			switch (msg.command) {
				case 'update':
					let debugSession = vscode.debug.activeDebugSession;
					if (debugSession) {
						if (debugSession.type == 'cppvsdbg' || debugSession.type == 'cppdbg') {
							console.log('MS Debugger')
						}
						let threads : Thread[] = [];
						for (const thread of (await debugSession.customRequest('threads')).threads || [])
						{
							let th = new Thread();
							th.id = thread.id;

							const framesResponse = await debugSession.customRequest('stackTrace', {
								threadId: th.id,
								startFrame: 0,
								levels: 200
							});

							for (const frame of framesResponse.stackFrames || []) {
								th.frames.push({
									fn: frame.name || ''
									// file: '',
									// line: 0
								});
							}

							threads.push(th);
						}
						let msg = {
							command: 'threads',
							threads: threads
						};
						if (currentPanel)
							currentPanel.webview.postMessage(msg);
					}
					break;
			}
		});
		currentPanel.reveal(vscode.ViewColumn.Active);
	}
}