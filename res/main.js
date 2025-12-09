// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

/**
 * @typedef Thread
 * @type {object}
 * @property {number} id - thread ID
 * @property {string} name - thread name
 */

/**
 * @typedef ThreadFrame
 * @type {object}
 * @property {string} name - Frame name
 * @property {string} type - type of the frame
 */

/**
 * @typedef ThreadNode
 * @type {object}
 * @property {Thread[]} threads - Thread ids contained in this node
 * @property {ThreadFrame[]} frames
 * @property {ThreadNode[]} children
 *
 * @property {{x: number, y: number}} bb - bounding box of the node, including its children
 */

/**
 * @typedef ViewState
 * @type {object}
 * @property {boolean} external - Show external code or not
*/

(function () {
	const vscode = acquireVsCodeApi();
	/**
	 * @type {ThreadNode|undefined}
	 */
	let threadsData = undefined;

	/**
	 * @type {ViewState}
	 */
	let state = {
		external: true
	};

	let needStateUpdate = true
	let vscodeState = /** @type {ViewState | undefined} */ (vscode.getState());
	console.log(vscodeState);
	if (vscodeState) {
		state = vscodeState;
		needStateUpdate = false;
	}

	const container = (document.getElementById('canvas-container'));
	if (!container) {
		return;
	}
	const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('thread-canvas'));
	if (!canvas) {
		return;
	}
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		return;
	}

	// const menuNode = document.createElement('div');
	// menuNode.id = 'menu';
	// menuNode.style.display = 'none';
	// menuNode.style.position = 'fixed';
	// menuNode.style.width = '60px';
	// menuNode.style.backgroundColor = 'white';
	// menuNode.style.boxShadow = '0 0 5px grey';
	// menuNode.style.borderRadius = '3px';

	// // Create buttons for the menu
	// const pulseButton = document.createElement('button');
	// pulseButton.textContent = 'Pulse';
	// pulseButton.style.width = '100%';
	// pulseButton.style.backgroundColor = 'white';
	// pulseButton.style.color = 'black';
	// pulseButton.style.border = 'none';
	// pulseButton.style.margin = '0';
	// pulseButton.style.padding = '10px';

	// const deleteButton = document.createElement('button');
	// deleteButton.textContent = 'Delete';
	// deleteButton.style.width = '100%';
	// deleteButton.style.backgroundColor = 'white';
	// deleteButton.style.color = 'black';
	// deleteButton.style.border = 'none';
	// deleteButton.style.margin = '0';
	// deleteButton.style.padding = '10px';

	// menuNode.appendChild(pulseButton);
	// menuNode.appendChild(deleteButton);
	// document.body.appendChild(menuNode);

	/**
	 * @param {ThreadNode} node
	 * @returns {number} children
	 */
	function countTotalChildren(node) {
		let children = 0;
		for (var i = 0; i < node.children.length; ++i) {
			children += countTotalChildren(node.children[i]);
		}

		return children + node.children.length;
	}

	/**
	 * @param {ThreadNode} node
	 * @returns {{x: number, y: number}} size
	 */
	function calcNodeSize(node) {
		if (!ctx) {
			return {x: 0, y: 0};
		}

		ctx.font = getComputedStyle(canvas).getPropertyValue('--vscode-editor-font-size') + ' ' + getComputedStyle(canvas).getPropertyValue('--vscode-editor-font-family');

		const externalText = '[External Code]';
		let externalNode = true;
		let externalBlockStart = -1;
		// TODO move hardcode values to css
		let size = {x: 0, y: 0};
		for (var i = 0; i < node.frames.length; ++i) {
			if (state.external || (!state.external && node.frames[i].type == 'normal')) {
			let frameSize = ctx.measureText(node.frames[i].name);
				if (size.x < frameSize.width + 10) {
					size.x = frameSize.width + 10;
				}
				size.y += frameSize.fontBoundingBoxAscent + frameSize.fontBoundingBoxDescent + 10;
				externalNode = false;
				externalBlockStart = -1;
			}
			else if (!state.external && node.frames[i].type == 'external') {
				if (externalBlockStart == -1) {
					externalBlockStart = i;
					let frameSize = ctx.measureText(externalText);
					if (size.x < frameSize.width + 10) {
						size.x = frameSize.width + 10;
					}
					size.y += frameSize.fontBoundingBoxAscent + frameSize.fontBoundingBoxDescent + 10;
				}
			}
		}

		if (externalNode && !state.external) {
			return {x: 0, y: 0};
		}

		// Node header
		let headerText = ''
		if (node.threads.length > 1) {
			headerText = node.threads.length + ' Threads';
		}
		else {
			headerText = node.threads[0].name + ' (' + node.threads[0].id + ')';
		}
		let headerSize = ctx.measureText(headerText);
		size.y += headerSize.fontBoundingBoxAscent + headerSize.fontBoundingBoxDescent + 10;
		if (size.x < headerSize.width + 10) {
			size.x = headerSize.width + 10;
		}
		return size;
	}

	/**
	 * @param {ThreadNode} node
	 */
	function calcNodeBB(node) {
		node.bb = {x: 0, y: 0};
		if (!ctx) {
			return;
		}
		ctx.font = getComputedStyle(canvas).getPropertyValue('--vscode-editor-font-size') + ' ' + getComputedStyle(canvas).getPropertyValue('--vscode-editor-font-family');

		// TODO move hardcode values to css
		let childrenBB = {x: 0, y: 0};
		for (var i = 0; i < node.children.length; ++i) {
			calcNodeBB(node.children[i]);
			if (childrenBB.x != 0) {
				childrenBB.x += 50;
			}

			childrenBB.x += node.children[i].bb.x;

			if (node.children[i].bb.y > childrenBB.y) {
				childrenBB.y = node.children[i].bb.y;
			}
		}

		let size = calcNodeSize(node);
		if (childrenBB.x != 0 && childrenBB.y != 0) {
			node.bb.y = 50;
			node.bb.x = childrenBB.x > size.x ? childrenBB.x : size.x;
			node.bb.y += childrenBB.y + size.y;
		}
		else {
			node.bb = size;
		}
	}

	let moving = false;
	let start = {x: 0, y: 0};
	let scroll = {x: 0, y: 0};
	const slider = document.getElementById('canvas-container');

	/**
	 * @param {MouseEvent} e
	 */
	function startMove(e) {
		if (slider === null || slider === undefined) {
			return;
		}
		moving = true;
		start.x = e.pageX;
		start.y = e.pageY;

		scroll.x = slider.scrollLeft;
		scroll.y = slider.scrollTop;
		canvas.style.cursor = 'grabbing';
	}

	/**
	 * @param {MouseEvent} e
	 */
	function stopMove(e) {
		moving = false;
		canvas.style.cursor = 'grab';
	}

	/**
	 * @param {MouseEvent} e
	 */
	function move(e) {
		e.preventDefault();
		if (!moving) {
			return;
		}
		if (slider === null || slider === undefined) {
			return;
		}

		const x = e.pageX;
		const y = e.pageY;

		const newScroll = {x: start.x - x + scroll.x, y: start.y - y + scroll.y};

		if (newScroll.x <= 0) {
			start.x = x;
			newScroll.x = 0;
			scroll.x = 0;
		}
		if (newScroll.y <= 0) {
			start.y = y;
			newScroll.y = 0;
			scroll.y = 0;
		}

		slider.scrollLeft = newScroll.x;
		slider.scrollTop = newScroll.y;
	}

	function resizeCanvas() {
		if (threadsData != undefined && container != undefined) {
			canvas.width = threadsData.bb.x + 50 > container.clientWidth ? threadsData.bb.x + 50: container.clientWidth;
			canvas.height = threadsData.bb.y + 50 > container.clientHeight ? threadsData.bb.y + 50: container.clientHeight;
		}

		drawGraph();
	}

	/**
	 * @param {ThreadNode} node
	 * @param {number} posX
	 * @param {number} posY
	 */
	function drawNode(node, posX, posY) {
		if (!ctx) {
			return;
		}

		const size = calcNodeSize(node);

		if (size.x != 0 && size.y != 0) {
			const externalText = '[External Code]';

			ctx.strokeStyle = 'grey'
			ctx.strokeRect(posX, posY, size.x, size.y);

			ctx.fillStyle = 'white';
			ctx.font = getComputedStyle(canvas).getPropertyValue('--vscode-editor-font-size') + ' ' + getComputedStyle(canvas).getPropertyValue('--vscode-editor-font-family');
			ctx.textBaseline = 'middle';

			let externalBlockStart = -1;
			let line = 0;

			// TODO move hardcode values to css
			let headerText = ''
			if (node.threads.length > 1) {
				headerText = node.threads.length + ' Threads';
			}
			else {
				headerText = node.threads[0].name + ' (' + node.threads[0].id + ')';
			}
			let headerSize = ctx.measureText(headerText);

			ctx.fillText(headerText, posX + (size.x - headerSize.width) / 2, posY + 15 + (headerSize.fontBoundingBoxAscent + headerSize.fontBoundingBoxDescent + 10)*line);
			ctx.strokeStyle = 'white'
			ctx.strokeRect(posX, posY, size.x, (headerSize.fontBoundingBoxAscent + headerSize.fontBoundingBoxDescent + 10) * (line+1));
			++line;

			for (var i = 0; i < node.frames.length; ++i) {
				let name = node.frames[node.frames.length - 1 - i].name;
				if (node.frames[node.frames.length - 1 - i].type == 'external') {
					if (state.external || externalBlockStart == -1) {
						externalBlockStart = node.frames.length - 1 - i;
						ctx.fillStyle = 'darkgrey'
						if (!state.external)
							name = externalText;
					} else {
						continue;
					}
				}
				else {
					externalBlockStart = -1;
					ctx.fillStyle = 'white';
				}

				let textSize = ctx.measureText(name);
				ctx.fillText(name, posX + 5, posY + 15 + (textSize.fontBoundingBoxAscent + textSize.fontBoundingBoxDescent + 10)*line);

				if (i < node.frames.length - 1) {
					ctx.strokeStyle = 'grey'
					ctx.beginPath();
					ctx.moveTo(posX, posY + (textSize.fontBoundingBoxAscent + textSize.fontBoundingBoxDescent + 10) * (line+1));
					ctx.lineTo(posX + size.x, posY + (textSize.fontBoundingBoxAscent + textSize.fontBoundingBoxDescent + 10) * (line+1))
					ctx.stroke();
				}
				++line;
			}
		}

		let pos = {x: posX - node.bb.x / 2 + size.x / 2, y: posY - 50};
		for (var i = 0; i < node.children.length; ++i) {
			const childSize = calcNodeSize(node.children[i]);
			if (childSize.x != 0 && childSize.y != 0) {
				if (size.x != 0 && size.y != 0) {
					ctx.strokeStyle = 'lightgray'
					ctx.beginPath();
					ctx.moveTo(posX + size.x / 2, posY);
					ctx.lineTo(pos.x + node.children[i].bb.x / 2, pos.y)
					ctx.stroke();
				}

				drawNode(node.children[i], pos.x + (node.children[i].bb.x - childSize.x) / 2, pos.y - childSize.y);
				pos.x += node.children[i].bb.x + 50;
			}
		}
	}

	function drawGraph() {
		if (!ctx || threadsData === undefined) {
			return;
		}

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		let size = calcNodeSize(threadsData);
		drawNode(threadsData, (threadsData.bb.x - size.x) / 2 + 10, threadsData.bb.y - size.y + 10);

		// for (var i = 0; i < 10; ++i) {
		// 	var posx = 15 + 300*i;
		// 	for (var j = 0; j < 10; ++j) {
		// 		var posy = 15 + 300*j;
		// 		ctx.fillStyle = 'white';
		// 		ctx.font = getComputedStyle(canvas).getPropertyValue('--vscode-editor-font-size') + ' ' + getComputedStyle(canvas).getPropertyValue('--vscode-editor-font-family');
		// 		ctx.textBaseline = 'middle';
		// 		ctx.fillText("ABABAB", posx + 15, posy + 15, 190);
		// 		ctx.strokeStyle = 'grey'
		// 		ctx.lineWidth = 1;
		// 		ctx.strokeRect(posx, posy, 200, 200);
		// 		ctx.beginPath();
		// 		ctx.moveTo(posx, 45);
		// 		ctx.lineTo(posx + 200, 45)
		// 		ctx.stroke();
		// 	}
		// }

		// ctx.strokeRect(1815, 1815, 200, 200);
	}

	document.addEventListener('DOMContentLoaded', () => {
		vscode.postMessage({
			command: 'update'
		});
		window.addEventListener('resize', resizeCanvas);

		canvas.addEventListener('mousedown', startMove);
		canvas.addEventListener('mousemove', move);
		canvas.addEventListener('mouseup', stopMove);
		canvas.addEventListener('mouseout', stopMove);

		// canvas.addEventListener('contextmenu', (e) => {
  		// 	// prevent default behavior
		// 	e.preventDefault();
		// 	menuNode.style.display = 'initial';
		// 	menuNode.style.top = e.clientY + 'px';
		// 	menuNode.style.left = e.clientX + 'px';
		// });

		// canvas.addEventListener('click', (e) => {
		// 	if (menuNode.style.display == 'initial') {
		// 		menuNode.style.display = 'none';
		// 	}
		// })

		drawGraph();
	});

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.command) {
            case 'threads':
				threadsData = message.threads;
				if (threadsData != undefined) {
					calcNodeBB(threadsData);
					console.log(threadsData)
					resizeCanvas();
				}
                break;
        }
    });

	const button = document.getElementById('update-button');
	button?.addEventListener('click', () => {
		console.log('update');
		vscode.postMessage({
			command: 'update'
		});
	})

	const externalToggle = /** @type {HTMLInputElement} */ (document.getElementById('external-code'));
	if (needStateUpdate) {
		state.external = externalToggle.checked;
	}
	else {
		externalToggle.checked = state.external;
	}
	externalToggle.addEventListener('click', () => {
		state.external = !state.external;

		vscode.postMessage({
			command: 'updateState',
			data: state
		});

		if (threadsData != undefined) {
			calcNodeBB(threadsData);
			console.log(threadsData)
			resizeCanvas();
		}
	});

	needStateUpdate = false;
}());
