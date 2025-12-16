
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
 * @property {{x: number, y: number}} size - size of the node
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

	let needStateUpdate = true;
	let vscodeState = /** @type {ViewState | undefined} */ (vscode.getState());
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

	function selectStyle() {
		if (document.body.className === 'vscode-dark') {
			const styleDark = {
				codeFont: Number(getComputedStyle(canvas).getPropertyValue('--vscode-editor-font-size').slice(0, -2)) - 2 + 'px ' + getComputedStyle(canvas).getPropertyValue('--vscode-editor-font-family'),
				font: getComputedStyle(canvas).getPropertyValue('--vscode-font-size') + ' ' + getComputedStyle(canvas).getPropertyValue('--vscode-font-family'),
				canvasMargin: 15,
				textMargin: 10,
				nodeSpacing: 50,

				textColor: 'white',
				externalColor: 'darkgrey',

				nodeColor: 'grey',
				headerColor: 'white',
				nodeLinkColor: 'lightgrey'
			};
			return styleDark;
		}
		else if (document.body.className === 'vscode-light') {
			const styleLight = {
				codeFont: Number(getComputedStyle(canvas).getPropertyValue('--vscode-editor-font-size').slice(0, -2)) - 2 + 'px ' + getComputedStyle(canvas).getPropertyValue('--vscode-editor-font-family'),
				font: getComputedStyle(canvas).getPropertyValue('--vscode-font-size') + ' ' + getComputedStyle(canvas).getPropertyValue('--vscode-font-family'),
				canvasMargin: 15,
				textMargin: 10,
				nodeSpacing: 50,

				textColor: 'black',
				externalColor: 'darkgrey',

				nodeColor: 'grey',
				headerColor: 'black',
				nodeLinkColor: 'darkgrey'
			};
			return styleLight;
		}
		else {
			// TODO high contrast
			const styleDark = {
				codeFont: Number(getComputedStyle(canvas).getPropertyValue('--vscode-editor-font-size').slice(0, -2)) - 2 + 'px ' + getComputedStyle(canvas).getPropertyValue('--vscode-editor-font-family'),
				font: getComputedStyle(canvas).getPropertyValue('--vscode-font-size') + ' ' + getComputedStyle(canvas).getPropertyValue('--vscode-font-family'),
				canvasMargin: 15,
				textMargin: 10,
				nodeSpacing: 50,

				textColor: 'white',
				externalColor: 'darkgrey',

				nodeColor: 'grey',
				headerColor: 'white',
				nodeLinkColor: 'lightgrey'
			};
			return styleDark;
		}
	}
	let style = selectStyle();

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
	 */
	function calcNodeSize(node) {
		node.size = { x: 0, y: 0 };
		if (!ctx) {
			return;
		}

		ctx.font = style.codeFont;
		ctx.textBaseline = 'middle';

		const externalText = '[External Code]';
		let externalNode = true;
		let externalBlockStart = -1;
		let size = { x: 0, y: 0 };
		for (var i = 0; i < node.frames.length; ++i) {
			if (state.external || (!state.external && node.frames[i].type === 'normal')) {
				let frameSize = ctx.measureText(node.frames[i].name);
				if (size.x < frameSize.width + style.textMargin) {
					size.x = frameSize.width + style.textMargin;
				}
				size.y += frameSize.fontBoundingBoxAscent + frameSize.fontBoundingBoxDescent + style.textMargin;
				externalNode = false;
				externalBlockStart = -1;
			}
			else if (!state.external && node.frames[i].type === 'external') {
				if (externalBlockStart === -1) {
					externalBlockStart = i;
					let frameSize = ctx.measureText(externalText);
					if (size.x < frameSize.width + style.textMargin) {
						size.x = frameSize.width + style.textMargin;
					}
					size.y += frameSize.fontBoundingBoxAscent + frameSize.fontBoundingBoxDescent + style.textMargin;
				}
			}
		}

		if (externalNode && !state.external) {
			let showExternalNode = false;
			for (var i = 0; i < node.children.length; ++i) {
				if (node.children[i].bb.x !== 0 || node.children[i].bb.y !== 0) {
					showExternalNode = true;
				}
			}

			if (!showExternalNode) {
				return;
			}
		}

		// Node header
		ctx.font = style.font;
		let headerText = '';
		if (node.threads.length > 1) {
			headerText = node.threads.length + ' Threads';
		}
		else {
			headerText = node.threads[0].name + ' (' + node.threads[0].id + ')';
		}
		let headerSize = ctx.measureText(headerText);
		size.y += headerSize.fontBoundingBoxAscent + headerSize.fontBoundingBoxDescent + style.textMargin;
		if (size.x < headerSize.width + style.textMargin) {
			size.x = headerSize.width + style.textMargin;
		}
		size.x = Math.round(size.x);
		size.y = Math.round(size.y);
		node.size = size;
	}

	/**
	 * @param {ThreadNode} node
	 */
	function calcNodeBB(node) {
		node.bb = { x: 0, y: 0 };
		if (!ctx) {
			return;
		}

		let childrenBB = { x: 0, y: 0 };
		for (var i = 0; i < node.children.length; ++i) {
			calcNodeBB(node.children[i]);
			if (childrenBB.x !== 0 && node.children[i].bb.x !== 0) {
				childrenBB.x += 50;
			}

			childrenBB.x += node.children[i].bb.x;

			if (node.children[i].bb.y > childrenBB.y) {
				childrenBB.y = node.children[i].bb.y;
			}
		}

		calcNodeSize(node);
		if (childrenBB.x !== 0 && childrenBB.y !== 0) {
			node.bb.y = 50;
			node.bb.x = childrenBB.x > node.size.x ? childrenBB.x : node.size.x;
			node.bb.y += childrenBB.y + node.size.y;
		}
		else {
			node.bb.x = node.size.x;
			node.bb.y = node.size.y;
		}
	}

	let moving = false;
	let start = { x: 0, y: 0 };
	let scroll = { x: 0, y: 0 };
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

		const newScroll = { x: start.x - x + scroll.x, y: start.y - y + scroll.y };

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
		// TODO Remove Y scrollbar if not needed
		if (threadsData !== undefined && container !== null) {
			canvas.width = (threadsData.bb.x + 50 > container.clientWidth ? threadsData.bb.x + 50 : container.clientWidth) * window.devicePixelRatio;
			canvas.height = (threadsData.bb.y > container.clientHeight - 10 ? threadsData.bb.y : container.clientHeight - 10) * window.devicePixelRatio;
		}
		ctx?.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);

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

		if (node.size.x !== 0 && node.size.y !== 0) {
			const externalText = '[External Code]';

			ctx.strokeStyle = style.nodeColor;
			ctx.strokeRect(posX + 0.5, posY + 0.5, node.size.x, node.size.y);

			ctx.lineWidth = 1;
			ctx.fillStyle = style.textColor;
			ctx.textBaseline = 'middle';

			let line = 0;

			ctx.font = style.font;
			let headerText = '';
			if (node.threads.length > 1) {
				headerText = node.threads.length + ' Threads';
			}
			else {
				headerText = node.threads[0].name + ' (' + node.threads[0].id + ')';
			}
			let headerSize = ctx.measureText(headerText);

			ctx.fillText(headerText, posX + (node.size.x - headerSize.width) / 2, posY + 1 + (headerSize.fontBoundingBoxAscent + headerSize.fontBoundingBoxDescent + style.textMargin) / 2);
			ctx.strokeStyle = style.headerColor;
			ctx.strokeRect(posX + 0.5, posY + 0.5, node.size.x, (headerSize.fontBoundingBoxAscent + headerSize.fontBoundingBoxDescent + style.textMargin) * (line + 1));
			let headerLine = (headerSize.fontBoundingBoxAscent + headerSize.fontBoundingBoxDescent + style.textMargin);

			ctx.font = style.codeFont;
			for (var i = 0; i < node.frames.length; ++i) {
				let name = node.frames[node.frames.length - 1 - i].name;
				if (node.frames[node.frames.length - 1 - i].type === 'external') {
					ctx.fillStyle = style.externalColor;
					if (!state.external) {
						for (var j = i + 1; j < node.frames.length; ++j) {
							if (node.frames[node.frames.length - 1 - j].type === 'external') {
								++i;
							}
							else {
								break;
							}
						}
						name = externalText;
					}
				}
				else {
					ctx.fillStyle = style.textColor;
				}

				let textSize = ctx.measureText(name);
				const lineY = (textSize.fontBoundingBoxAscent + textSize.fontBoundingBoxDescent + style.textMargin);

				ctx.fillText(name, posX + style.textMargin / 2, posY + 1 + headerLine + lineY / 2 + lineY * line);

				if (i < node.frames.length - 1) {
					ctx.strokeStyle = style.nodeColor;
					ctx.beginPath();
					ctx.moveTo(posX + 0.5, posY + 0.5 + headerLine + lineY * (line + 1));
					ctx.lineTo(posX + 0.5 + node.size.x, posY + 0.5 + headerLine + lineY * (line + 1));
					ctx.stroke();
				}
				++line;
			}
		}

		let pos = { x: posX - node.bb.x / 2 + node.size.x / 2, y: posY - style.nodeSpacing };
		for (var i = 0; i < node.children.length; ++i) {
			if (node.children[i].size.x !== 0 && node.children[i].size.y !== 0) {
				if (node.size.x !== 0 && node.size.y !== 0) {
					ctx.strokeStyle = style.nodeLinkColor;
					ctx.beginPath();
					ctx.moveTo(posX + 0.5 + node.size.x / 2, posY + 0.5);
					ctx.lineTo(pos.x + 0.5 + node.children[i].bb.x / 2, pos.y + 0.5);
					ctx.stroke();
				}

				drawNode(node.children[i], pos.x + (node.children[i].bb.x - node.children[i].size.x) / 2, pos.y - node.children[i].size.y);
				pos.x += node.children[i].bb.x + style.nodeSpacing;
			}
		}
	}

	function drawGraph() {
		if (!ctx || threadsData === undefined) {
			return;
		}

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		drawNode(threadsData, (threadsData.bb.x - threadsData.size.x) / 2 + style.canvasMargin, threadsData.bb.y - threadsData.size.y + style.canvasMargin);
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
				if (threadsData !== undefined) {
					calcNodeBB(threadsData);
					resizeCanvas();
				}
				else {
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					// TODO msg to tell no debug session is started
				}
				break;
			case 'continue':
				ctx.fillStyle = '#00000063';
				ctx.fillRect(0, 0, canvas.width, canvas.height);
				break;
			case 'theme':
				style = selectStyle();
				drawGraph();
				break;
		}
	});

	const button = document.getElementById('external-button');
	button?.addEventListener('click', (e) => {
		button.classList.toggle('toggle');

		state.external = !state.external;

		vscode.postMessage({
			command: 'updateState',
			data: state
		});

		if (threadsData !== undefined) {
			calcNodeBB(threadsData);
			console.log(threadsData);
			resizeCanvas();
		}
	});
	if (needStateUpdate) {
		state.external = button?.className === 'toggle';
	}
	else {
		if (state.external) { button?.classList.toggle('toggle'); }
	}

	needStateUpdate = false;
}());
