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
		if (stackLevel >= children[0].frames.length)
			break;

		let relatives: Node[][] = [];
		relatives.push(new Array(children[0]));
		for (var i = 1; i < children.length; ++i) {
			let found: boolean = false;
			for (var j = 0; j < relatives.length; ++j) {
				if (children[i] == relatives[j][0])
					continue;
				if (children[i].frames[stackLevel].name == relatives[j][0].frames[stackLevel].name) {
					relatives[j].push(children[i]);
					found = true;
				}
			}

			if (!found) {
				relatives.push(new Array(children[i]));
			}
		}

		// if (siblings.length > 0) {
		// 	let newNode: Node = new Node();
		// 	for (var i = 0; i < stackLevel; ++i) {
		// 		parent.frames.push(siblings[0].frames[i]);
		// 	}
		// 	for (const child of siblings) {
		// 		child.frames.splice(0, stackLevel + 1);
		// 	}

		// 	parent.children.push(newNode);

		// 	parseNodes(newNode, siblings);
		// }

		if (relatives.length > 1) {
			for (var i = 0; i < stackLevel; ++i) {
				parent.frames.push(children[0].frames[i]);
			}

			for (const child of children) {
				child.frames.splice(0, stackLevel);
			}

			for (const siblings of relatives) {
				if (siblings.length > 1) {
					let newNode: Node = new Node();					
					parseNodes(newNode, siblings);

					for (const sibling of siblings) {
						const idx = children.indexOf(sibling)
						children.splice(idx, 1);
					}
						
				} else {
					parent.children.push(siblings[0]);
					const idx = children.indexOf(siblings[0])
					children.splice(idx, 1);
				}
			}
		}
		stackLevel++;
	}

	if (children.length > 0) {
		for (var i = 0; i < children.length; ++i) {
			parent.children.push(children[i]);
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
			child.frames.push({
				name: frame.name || ''
			});
		}
		child.frames.reverse();

		children.push(child);
	}

	parseNodes(root, children);

	return root;
}