import * as vscode from 'vscode';

export class Thread {
	id: number = 0;
	name: string = '';
}

export class Frame {
	name: string = '';
	type: string = '';
	source: string = '';
	line: number = 0;
	ids: number[] = [];
}

export class Node {
	threads: Thread[] = [];
	frames: Frame[] = [];

	children: Node[] = [];
}

let nodeRoot: Node | undefined = undefined;

function parseNodes(parent: Node, children: Node[]) {
	let stackLevel = 0;
	while (children.length > 0) {
		if (stackLevel >= children[0].frames.length) { break; }

		let relatives: Node[][] = [];
		for (var i = 0; i < children.length; ++i) {
			let found: boolean = false;
			for (var j = 0; j < relatives.length; ++j) {
				if (children[i].frames[stackLevel].name === relatives[j][0].frames[stackLevel].name) {
					relatives[j].push(children[i]);
					found = true;
					break;
				}
			}

			if (!found) {
				relatives.push(new Array(children[i]));
			}
		}

		if (relatives.length > 1) {
			for (var i = 0; i < stackLevel; ++i) {
				parent.frames.push(children[0].frames[i]);
				for (var j = 1; j < children.length; ++j) {
					parent.frames[i].ids.push(children[j].frames[i].ids[0]);
				}
			}

			for (const child of children) {
				child.frames.splice(0, stackLevel);
			}

			for (const siblings of relatives) {
				if (siblings.length > 1) {
					let newNode: Node = new Node();
					parent.children.push(newNode);

					for (const sibling of siblings) {
						for (var i = 0; i < sibling.threads.length; ++i) {
							newNode.threads.push(sibling.threads[i]);
						}
						const idx = children.indexOf(sibling);
						console.assert(idx !== -1);
						children.splice(idx, 1);
					}

					parseNodes(newNode, siblings);

				} else {
					parent.children.push(siblings[0]);
					const idx = children.indexOf(siblings[0]);
					console.assert(idx !== -1);
					children.splice(idx, 1);
				}
			}
			console.assert(children.length === 0);
			break;
		}
		stackLevel++;
	}

	if (children.length > 0) {
		for (var i = 0; i < stackLevel; ++i) {
			parent.frames.push(children[0].frames[i]);
			for (var j = 0; j < children.length; ++j) {
				parent.frames[i].ids.push(children[j].frames[i].ids[0]);
			}
		}
	}
}


export async function createThreadTree(debugSession: vscode.DebugSession) {
	nodeRoot = new Node();
	let children: Node[] = [];

	try {
		for (const th of (await debugSession.customRequest('threads')).threads) {
			let thread = new Thread();
			thread.id = th.id;
			thread.name = th.name;

			nodeRoot.threads.push(thread);

			let child: Node = new Node();
			child.threads.push(thread);

			// TODO correctly respect request specs.
			// Need to loop over requests until frames retrieved == totalFrames
			const framesResponse = await debugSession.customRequest('stackTrace', {
				threadId: th.id,
				startFrame: 0,
				levels: 200,
				format: {
					parameters: false,
					parametersTypes: false,
					parametersNames: false,
					parametersValues: false,
					line: false,
					module: true,
					includeAll: true
				}
			});

			for (const frame of framesResponse.stackFrames || []) {
				if (frame.presentationHint && frame.presentationHint === 'label') {
					continue;
				}

				let elem = {
					name: frame.name || '',
					type: frame.source === undefined ? 'external' : 'normal',
					source: frame.source !== undefined ? frame.source.path : '',
					line: frame.line || 0,
					ids: [frame.id]
				};

				if (frame.presentationHint && frame.presentationHint === 'subtle') {
					elem.type = 'external';
				}

				if (frame.source && frame.source.presentationHint && frame.source.presentationHint === 'deemphasize') {
					elem.type = 'external';
				}

				// CodeLLDB specific
				if (frame.source && frame.source.origin && frame.source.origin === 'disassembly') {
					elem.type = 'external';
				}

				child.frames.push(elem);
			}

			child.frames.reverse();

			children.push(child);
		}
	}
	catch (e: any) {
		if (e.name === 'CodeExpectedError') {
			return undefined;
		}
		throw e;
	}

	parseNodes(nodeRoot, children);

	return nodeRoot;
}

export function findNode(threadID: number): Node | undefined {
	if (nodeRoot) {
		return findNodeRecurse(threadID, nodeRoot);
	}
	return undefined;
}

function findNodeRecurse(threadID: number, node: Node): Node | undefined {
	let res = node.threads.find((val: Thread) => { if (val.id === threadID) { return true; } });
	if (res !== undefined) {
		return node;
	}

	for (var i = 0; i < node.children.length; ++i) {
		let nodeRes: Node | undefined = findNodeRecurse(threadID, node.children[i]);
		if (nodeRes !== undefined) {
			return nodeRes;
		}
	}

	return undefined;
}