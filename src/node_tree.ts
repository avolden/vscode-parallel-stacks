import * as vscode from 'vscode';

export class Frame {
	name: string = '';
}

export class Node {
	ids: number[] = [];
	frames: Frame[] = [];

	children: Node[] = [];
}

function parseNodes(parent: Node, children: Node[]) {
	let stackLevel = 0;
	while (children.length > 0) {
		let siblings: Node[] = [];
		let frame = children[0].frames[stackLevel];
		for (var i = 1; i < children.length; ++i) {
			if (children[i].frames[stackLevel] != frame) {
				siblings.push(children[i]);
				children.splice(i, 1);
			}
		}

		if (siblings.length > 0) {
			let newNode: Node = new Node();
		}
	}
}


export async function createThreadTree(debugSession: vscode.DebugSession) {
	let root = new Node();
	let children: Node[] = [];

	for (const th of (await debugSession.customRequest('threads')).threads) {
		root.ids.push(th.id);

		let child: Node = new Node();
		child.ids.push(th.id);

		const framesResponse = await debugSession.customRequest('stackTrace', {
			threadId: th.id,
			startFrame: 0,
			levels: 200
		});
		
		for (const frame of framesResponse.stackFrames || []) {
			th.frames.push({
				fn: frame.name || ''
			});
		}

		children.push(child);
	}

	parseNodes(root, children);

	return root;
}