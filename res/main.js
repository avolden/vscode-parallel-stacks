
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
 * @property {number[]} ids - frame ids of the frame, as the debug adapter send them
 */

/**
 * @typedef ThreadNode
 * @type {object}
 * @property {Thread[]} threads - Thread ids contained in this node
 * @property {ThreadFrame[]} frames
 * @property {number | undefined} parentId
 * @property {ThreadNode[]} children
 *
 * @property {{x: number, y: number}} bb - bounding box of the node, including its children
 * @property {{x: number, y: number}} size - size of the node
 * @property {{x: number, y: number}} pos - position of the node
 * @property {boolean} externalNode - Indicates if hte node contains only external functions
 * @property {number} headerHeight - height of the header line
 */

/**
 * @typedef ViewState
 * @type {object}
 * @property {boolean} external - Show external code or not
 * @property {boolean} autoFocus - Auto focus on active item when it changes
*/

/**
 * @typedef HoverState
 * @property {ThreadNode | undefined} node - Current node the tooltip is displaying information about
 * @property {number} func - line number being hovered
*/

/**
 * @typedef TooltipState
 * @type {object}
 * @property {ThreadNode | undefined} node - Current node the tooltip is displaying information about
 * @property {HTMLElement} elem - Tooltip HTML element
 */

/**
 * @typedef ActiveItem
 * @type {object}
 * @property {ThreadNode | undefined} node - node of the active item
 * @property {number} frameID - frame index of the active item
 */

(function () {
	const vscode = acquireVsCodeApi();
	/**
	 * @type {ThreadNode|undefined}
	 */
	let rootNode = undefined;

	/**
	 * @type {ThreadNode[]}
	 */
	let nodes = [];

	/**
	 * @type {ActiveItem}
	 */
	let activeItem = {
		node: undefined,
		frameID: -1
	};

	/**
	 * @type {HoverState}
	 */
	let hover = {
		node: undefined,
		func: -1
	};

	/**
	 * @type {ViewState}
	 */
	let state = {
		external: true,
		autoFocus: true
	};
	let disableInteractions = true;

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

	const overlayText = document.getElementById("canvas-info");
	if (!overlayText) {
		return;
	}

	/**
	 * @type {TooltipState}
	 */
	let tooltip = {
		node: undefined,
		elem: document.createElement('div')
	};
	tooltip.elem.style.display = 'none';
	tooltip.elem.style.position = 'fixed';
	tooltip.elem.style.backgroundColor = getComputedStyle(canvas).getPropertyValue('--vscode-editorWidget-background');
	tooltip.elem.style.boxShadow = '0 0 5px black';
	tooltip.elem.style.borderRadius = '3px';
	tooltip.elem.style.padding = '.5em';
	tooltip.elem.style.margin = '.8em';
	tooltip.elem.style.pointerEvents = 'none';
	document.body.appendChild(tooltip.elem);

	function selectStyle() {
		if (document.body.className === 'vscode-dark') {
			const styleDark = {
				codeFont: Number(getComputedStyle(canvas).getPropertyValue('--vscode-editor-font-size').slice(0, -2)) - 2 + 'px ' + getComputedStyle(canvas).getPropertyValue('--vscode-editor-font-family'),
				font: getComputedStyle(canvas).getPropertyValue('--vscode-font-size') + ' ' + getComputedStyle(canvas).getPropertyValue('--vscode-font-family'),
				canvasMargin: 15,
				textMargin: 10,
				nodeSpacing: 51,

				activeItemBorderColor: getComputedStyle(canvas).getPropertyValue('--vscode-editorWidget-border'),
				hoverFillColor: '#ffffff44',
				textColor: 'white',
				externalColor: 'darkgrey',

				nodeColor: 'grey',
				headerColor: 'white',
				nodeLinkColor: 'lightgrey'
			};

			tooltip.elem.style.backgroundColor = getComputedStyle(canvas).getPropertyValue('--vscode-editorWidget-background');
			return styleDark;
		}
		else if (document.body.className === 'vscode-light') {
			const styleLight = {
				codeFont: Number(getComputedStyle(canvas).getPropertyValue('--vscode-editor-font-size').slice(0, -2)) - 2 + 'px ' + getComputedStyle(canvas).getPropertyValue('--vscode-editor-font-family'),
				font: getComputedStyle(canvas).getPropertyValue('--vscode-font-size') + ' ' + getComputedStyle(canvas).getPropertyValue('--vscode-font-family'),
				canvasMargin: 15,
				textMargin: 10,
				nodeSpacing: 51,

				activeItemBorderColor: getComputedStyle(canvas).getPropertyValue('--vscode-editorWidget-border'),
				hoverFillColor: 'darkgrey',
				textColor: 'black',
				externalColor: 'lightgrey',

				nodeColor: 'grey',
				headerColor: 'black',
				nodeLinkColor: 'darkgrey'
			};

			tooltip.elem.style.backgroundColor = getComputedStyle(canvas).getPropertyValue('--vscode-editorWidget-background');
			return styleLight;
		}
		else {
			// TODO high contrast
			const styleDark = {
				codeFont: Number(getComputedStyle(canvas).getPropertyValue('--vscode-editor-font-size').slice(0, -2)) - 2 + 'px ' + getComputedStyle(canvas).getPropertyValue('--vscode-editor-font-family'),
				font: getComputedStyle(canvas).getPropertyValue('--vscode-font-size') + ' ' + getComputedStyle(canvas).getPropertyValue('--vscode-font-family'),
				canvasMargin: 15,
				textMargin: 10,
				nodeSpacing: 51,

				activeItemBorderColor: getComputedStyle(canvas).getPropertyValue('--vscode-editorWidget-border'),
				hoverFillColor: 'lightgrey',
				textColor: 'white',
				externalColor: 'darkgrey',

				nodeColor: 'grey',
				headerColor: 'white',
				nodeLinkColor: 'lightgrey'
			};

			tooltip.elem.style.backgroundColor = getComputedStyle(canvas).getPropertyValue('--vscode-editorWidget-background');
			return styleDark;
		}
	}
	let style = selectStyle();

	/**
	 * @param {ThreadNode} node 
	 * @returns {boolean}
	 */
	function allParentsExternal(node) {
		if (!node.parentId) {
			return true;
		}
		if (nodes[node.parentId].externalNode) {
			return allParentsExternal(node);
		} else {
			return false;
		}
	}

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

		node.externalNode = externalNode;
		if (externalNode && !state.external) {
			let showExternalNode = false;
			for (var i = 0; i < node.children.length; ++i) {
				if (node.children[i].bb.x !== 0 || node.children[i].bb.y !== 0) {
					showExternalNode = true;
				}
			}

			if (!showExternalNode && allParentsExternal(node)) {
				node.size = { x: 0, y: 0 };
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
		node.headerHeight = headerSize.fontBoundingBoxAscent + headerSize.fontBoundingBoxDescent + style.textMargin;
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
				childrenBB.x += style.nodeSpacing;
			}

			childrenBB.x += node.children[i].bb.x;

			if (node.children[i].bb.y > childrenBB.y) {
				childrenBB.y = node.children[i].bb.y;
			}
		}

		calcNodeSize(node);
		if (childrenBB.x !== 0 && childrenBB.y !== 0) {
			node.bb.x = childrenBB.x > node.size.x ? childrenBB.x : node.size.x;
			node.bb.y = childrenBB.y + node.size.y + style.nodeSpacing;
		}
		else {
			node.bb.x = node.size.x;
			node.bb.y = node.size.y;
		}
	}

	/**
	 * @param {ThreadNode} node
	 */
	function calcNodePos(node) {
		if (node === rootNode) {
			node.pos = { x: Math.round((node.bb.x - node.size.x) / 2) + style.canvasMargin, y: node.bb.y - node.size.y + style.canvasMargin };
		}

		if (node.size.x === -1 || node.size.y === -1) {
			node.pos = { x: -1, y: -1 };
		}

		let childPos = { x: Math.round(node.pos.x - node.bb.x / 2 + node.size.x / 2), y: node.pos.y - style.nodeSpacing };
		for (var i = 0; i < node.children.length; ++i) {
			node.children[i].pos = { x: -1, y: -1 };
			if (node.children[i].size.x !== 0 && node.children[i].size.y !== 0) {
				node.children[i].pos = { x: childPos.x + Math.round((node.children[i].bb.x - node.children[i].size.x) / 2), y: childPos.y - node.children[i].size.y };
				calcNodePos(node.children[i]);
				childPos.x += node.children[i].bb.x + style.nodeSpacing;
			}
		}
	}

	/**
	 * @param {ThreadNode} node
	 */
	function fillNodes(node) {
		nodes.push(node);
		let nodeId = nodes.length - 1;
		for (var i = 0; i < node.children.length; ++i) {
			node.children[i].parentId = nodeId;
			fillNodes(node.children[i]);
		}
	}

	/**
	 * @param {ThreadNode} node
	 * @param {{x: number, y: number}} mousePos
	 * @returns {number} function
	 */
	function getFunctionIdx(node, mousePos) {
		if (ctx === null) {
			return -1;
		}
		mousePos.x -= node.pos.x;
		mousePos.y -= node.pos.y + node.headerHeight;

		let currentY = 0;
		for (var i = 0; i < node.frames.length; ++i) {
			if (state.external || (!state.external && node.frames[i].type === 'normal')) {
				let frameSize = ctx.measureText(node.frames[i].name);
				let lineHeight = frameSize.fontBoundingBoxAscent + frameSize.fontBoundingBoxDescent + style.textMargin;
				if (mousePos.y >= currentY && mousePos.y <= currentY + lineHeight) {
					return i;
				}
				currentY += lineHeight;
			}
		}

		return -1;
	}

	/**
	 * @param {ThreadNode} node
	 * @param {number} threadID
	 * @param {number} frameID
	 */
	function computeActiveItemRecurse(node, threadID, frameID) {
		if (frameID < 0) {
			if (node.children.length === 0) {
				activeItem.node = node;
				activeItem.frameID = 0;
			}
			return true;
		}
		else {
			for (var i = 0; i < node.frames.length; ++i) {
				let frameFound = node.frames[i].ids.find((id) => { return id === frameID; });

				if (frameFound) {
					activeItem.node = node;
					activeItem.frameID = node.frames.length - 1 - i;
					return true;
				}
			}
		}

		for (var i = 0; i < node.children.length; ++i) {
			let found = node.children[i].threads.find((val) => { if (val.id === threadID) { return true; } }) !== undefined;

			if (found && computeActiveItemRecurse(node.children[i], threadID, frameID)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * @param {number} threadID
	 * @param {number} frameID
	 */
	function computeActiveItem(threadID, frameID) {
		if (!rootNode) {
			return;
		}

		if (!computeActiveItemRecurse(rootNode, threadID, frameID)) {
			activeItem.node = undefined;
			activeItem.frameID = -1;
		}
	}

	let moving = false;
	let start = { x: 0, y: 0 };
	let scroll = { x: 0, y: 0 };
	const slider = document.getElementById('canvas-container');

	/**
	 * @param {MouseEvent} e
	 */
	function click(e) {
		if (hover.node) {
			vscode.postMessage({
				command: 'open',
				node: hover.node,
				func: hover.func
			});
		}
	}
	/**
	 * @param {MouseEvent} e
	 */
	function startMove(e) {
		if (slider === null || slider === undefined) {
			return;
		}
		if (disableInteractions) {
			return;
		}

		for (var i = 0; i < nodes.length; ++i) {
			if ((e.offsetX >= nodes[i].pos.x) &&
				(e.offsetX < nodes[i].pos.x + nodes[i].size.x) &&
				(e.offsetY >= nodes[i].pos.y) &&
				(e.offsetY < nodes[i].pos.y + nodes[i].size.y)) {
				return;
			}
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
		if (moving) {
			moving = false;
			canvas.style.cursor = 'grab';
		}
	}

	/**
	 * @param {MouseEvent} e
	 */
	function move(e) {
		if (disableInteractions) {
			return;
		}
		e.preventDefault();
		if (!moving) {
			if (disableInteractions) {
				return;
			}
			let foundHeader = false;
			let foundNode = false;
			for (var i = 0; i < nodes.length; ++i) {
				if ((e.offsetX >= nodes[i].pos.x) &&
					(e.offsetX < nodes[i].pos.x + nodes[i].size.x) &&
					(e.offsetY >= nodes[i].pos.y) &&
					(e.offsetY < nodes[i].pos.y + nodes[i].headerHeight)) {
					canvas.style.cursor = 'default';
					foundHeader = true;

					if (tooltip.elem.style.display === 'none' && nodes[i].threads.length > 1) {
						tooltip.elem.style.display = 'initial';
						tooltip.elem.style.top = e.clientY + 'px';
						tooltip.elem.style.left = e.clientX + 'px';

						tooltip.node = nodes[i];

						tooltip.elem.replaceChildren();

						for (var j = 0; j < tooltip.node.threads.length; ++j) {
							let line = document.createElement('div');
							line.textContent = tooltip.node.threads[j].name + ' (' + tooltip.node.threads[j].id + ')';
							line.style.textWrapMode = 'nowrap';

							tooltip.elem.appendChild(line);
						}

					}

					if (tooltip.node === nodes[i]) {
						tooltip.elem.style.top = e.clientY + 'px';
						tooltip.elem.style.left = e.clientX + 'px';
					}

					break;
				}
				else if ((e.offsetX >= nodes[i].pos.x) &&
					(e.offsetX < nodes[i].pos.x + nodes[i].size.x) &&
					(e.offsetY >= nodes[i].pos.y + nodes[i].headerHeight) &&
					(e.offsetY < nodes[i].pos.y + nodes[i].size.y)) {
					canvas.style.cursor = 'pointer';
					foundNode = true;

					let funcIdx = getFunctionIdx(nodes[i], { x: e.offsetX, y: e.offsetY });
					if (nodes[i] !== hover.node || funcIdx !== hover.func) {

						hover.node = nodes[i];
						hover.func = funcIdx;

						redrawCanvas();
					}
				}
			}

			if (!foundHeader) {
				tooltip.node = undefined;
				tooltip.elem.style.display = 'none';
			}
			if (!foundNode) {
				let needRedraw = hover.node !== undefined;
				hover.node = undefined;
				hover.func = -1;
				if (needRedraw) {
					redrawCanvas();
				}
			}
			if (!foundHeader && !foundNode) {
				canvas.style.cursor = 'grab';
			}

			return;
		}
		else if (tooltip.node !== undefined) {
			tooltip.node = undefined;
			tooltip.elem.style.display = 'none';
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

	function scrollToActiveItem() {
		if (!slider || !activeItem.node) {
			return;
		}

		const node = activeItem.node;
		const nodeLeft = node.pos.x;
		const nodeTop = node.pos.y;
		const nodeRight = node.pos.x + node.size.x;
		const nodeBottom = node.pos.y + node.size.y;

		const containerWidth = slider.clientWidth;
		const containerHeight = slider.clientHeight;
		const scrollLeft = slider.scrollLeft;
		const scrollTop = slider.scrollTop;

		// Calculate the target scroll position to center the node in the viewport
		const targetScrollLeft = Math.max(0, nodeLeft - (containerWidth - node.size.x) / 2);
		const targetScrollTop = Math.max(0, nodeTop - (containerHeight - node.size.y) / 2);

		slider.scrollLeft = targetScrollLeft;
		slider.scrollTop = targetScrollTop;
	}

	function redrawCanvas() {
		if (!ctx) {
			return;
		}

		// TODO Remove Y scrollbar if not needed
		if (rootNode !== undefined && container !== null) {
			canvas.width = (rootNode.bb.x + 50 > container.clientWidth ? rootNode.bb.x + 50 : container.clientWidth) * window.devicePixelRatio;
			canvas.height = (rootNode.bb.y > container.clientHeight - 3 ? rootNode.bb.y : container.clientHeight - 3) * window.devicePixelRatio;
		}
		else if (rootNode === undefined && container !== null) {
			canvas.width = container.clientWidth * window.devicePixelRatio;
			canvas.height = container.clientHeight - 3 * window.devicePixelRatio;
		}
		ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		if (rootNode !== undefined) {
			drawNode(rootNode);
		}

		if (disableInteractions) {
			ctx.fillStyle = '#00000063';
			ctx.fillRect(0, 0, canvas.width, canvas.height);
		}
	}

	/**
	 * @param {ThreadNode} node
	 */
	function drawNode(node) {
		if (!ctx) {
			return;
		}

		if (node.size.x !== 0 && node.size.y !== 0) {
			const externalText = '[External Code]';

			ctx.strokeStyle = style.nodeColor;
			ctx.strokeRect(node.pos.x + 0.5, node.pos.y + 0.5, node.size.x, node.size.y);

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

			ctx.fillText(headerText, node.pos.x + (node.size.x - headerSize.width) / 2, node.pos.y + 1 + (headerSize.fontBoundingBoxAscent + headerSize.fontBoundingBoxDescent + style.textMargin) / 2);
			ctx.strokeStyle = style.headerColor;
			ctx.strokeRect(node.pos.x + 0.5, node.pos.y + 0.5, node.size.x, (headerSize.fontBoundingBoxAscent + headerSize.fontBoundingBoxDescent + style.textMargin) * (line + 1));
			let headerLine = (headerSize.fontBoundingBoxAscent + headerSize.fontBoundingBoxDescent + style.textMargin);

			let hoverLine = -1;
			if (hover.node === node) {
				hoverLine = hover.func;
			}

			let activeLine = -1;
			if (activeItem.node === node) {
				activeLine = activeItem.frameID;
			}

			ctx.font = style.codeFont;
			for (var i = 0; i < node.frames.length; ++i) {
				let name = node.frames[node.frames.length - 1 - i].name;
				let textStyle = '';
				if (node.frames[node.frames.length - 1 - i].type === 'external') {
					textStyle = style.externalColor;
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
					textStyle = style.textColor;
				}

				let textSize = ctx.measureText(name);
				const lineY = (textSize.fontBoundingBoxAscent + textSize.fontBoundingBoxDescent + style.textMargin);

				if (state.external || (!state.external && name !== externalText)) {
					if (i === hoverLine) {
						ctx.fillStyle = style.hoverFillColor;
						ctx.fillRect(node.pos.x + 1, node.pos.y + headerLine + lineY * line + 1, node.size.x - 1, lineY - 1);
					}

					if (i === activeLine) {
						ctx.fillStyle = style.activeItemBorderColor;
						ctx.fillRect(node.pos.x + 1, node.pos.y + headerLine + lineY * line + 1, 3, lineY - 1);
					}
				}
				ctx.fillStyle = textStyle;
				ctx.fillText(name, node.pos.x + style.textMargin / 2, node.pos.y + 1 + headerLine + lineY / 2 + lineY * line);

				if (i < node.frames.length - 1) {
					ctx.strokeStyle = style.nodeColor;
					ctx.beginPath();
					ctx.moveTo(node.pos.x + 0.5, node.pos.y + 0.5 + headerLine + lineY * (line + 1));
					ctx.lineTo(node.pos.x + 0.5 + node.size.x, node.pos.y + 0.5 + headerLine + lineY * (line + 1));
					ctx.stroke();
				}
				++line;
			}
		}

		let pos = { x: Math.round(node.pos.x - node.bb.x / 2 + node.size.x / 2), y: node.pos.y - style.nodeSpacing };
		if (node.children.length > 0) {
			ctx.strokeStyle = style.nodeLinkColor;
			ctx.beginPath();
			ctx.moveTo(node.pos.x + Math.round(node.size.x / 2) + 0.5, node.pos.y);
			ctx.lineTo(node.pos.x + Math.round(node.size.x / 2) + 0.5, node.pos.y - Math.round((style.nodeSpacing - 1) / 2));
			ctx.stroke();

			let lineStartX = 0;
			for (var i = 0; i < node.children.length; ++i) {
				if (node.children[i].pos.x !== -1 && node.children[i].pos.y !== -1) {
					lineStartX = node.children[i].pos.x + Math.round(node.children[i].size.x / 2);
					break;
				}
			}

			let lineEndX = 0;
			for (var i = node.children.length - 1; i >= 0; --i) {
				if (node.children[i].pos.x !== -1 && node.children[i].pos.y !== -1) {
					lineEndX = node.children[i].pos.x + Math.round(node.children[i].size.x / 2);
					break;
				}
			}

			if (lineStartX !== 0 && lineEndX !== 0 && lineStartX !== lineEndX) {
				ctx.strokeStyle = style.nodeLinkColor;
				ctx.beginPath();
				ctx.moveTo(lineStartX, node.pos.y - 0.5 - Math.round((style.nodeSpacing - 1) / 2));
				ctx.lineTo(lineEndX + 1, node.pos.y - 0.5 - Math.round((style.nodeSpacing - 1) / 2));
				ctx.stroke();
			}
			else if (lineStartX === lineEndX) {
				ctx.strokeStyle = style.nodeLinkColor;
				ctx.beginPath();
				ctx.moveTo(lineStartX + 0.5, node.pos.y - Math.round((style.nodeSpacing - 1) / 2));
				ctx.lineTo(lineEndX + 0.5, node.pos.y - Math.round((style.nodeSpacing - 1) / 2) - 1);
				ctx.stroke();
			}
		}

		for (var i = 0; i < node.children.length; ++i) {
			if (node.children[i].size.x !== 0 && node.children[i].size.y !== 0) {
				if (node.size.x !== 0 && node.size.y !== 0) {
					ctx.strokeStyle = style.nodeLinkColor;
					ctx.beginPath();
					ctx.moveTo(node.children[i].pos.x + Math.round(node.children[i].size.x / 2) + 0.5, node.children[i].pos.y + node.children[i].size.y);
					ctx.lineTo(node.children[i].pos.x + Math.round(node.children[i].size.x / 2) + 0.5, node.children[i].pos.y + node.children[i].size.y + Math.round((style.nodeSpacing - 1) / 2));
					ctx.stroke();
				}

				drawNode(node.children[i]);
				pos.x += node.children[i].bb.x + style.nodeSpacing;
			}
		}
	}

	document.addEventListener('DOMContentLoaded', () => {
		vscode.postMessage({
			command: 'update'
		});
		window.addEventListener('resize', redrawCanvas);

		canvas.addEventListener('click', click);
		canvas.addEventListener('mousedown', startMove);
		canvas.addEventListener('mousemove', move);
		canvas.addEventListener('mouseup', stopMove);
		canvas.addEventListener('mouseout', stopMove);

		// redrawCanvas();
	});

	// Handle messages sent from the extension to the webview
	window.addEventListener('message', event => {
		const message = event.data; // The json data that the extension sent
		switch (message.command) {
			case 'threads':
				rootNode = message.threads;
				nodes.splice(0);
				if (rootNode !== undefined) {
					overlayText.style.display = 'none';
					disableInteractions = false;
					fillNodes(rootNode);
					calcNodeBB(rootNode);
					calcNodePos(rootNode);
					redrawCanvas();
				}
				break;
			case 'activeItem':
				computeActiveItem(message.threadID, message.frameID);
				if (message.focus && state.autoFocus) {
					scrollToActiveItem();
				}
				redrawCanvas();
				break;
			case 'initialize':
			case 'continue':
				overlayText.style.display = 'initial';
				overlayText.textContent = 'Program is currently running. Pause the execution to display threads.';
				disableInteractions = true;
				tooltip.elem.style.display = 'none';
				redrawCanvas();
				break;
			case 'disconnect':
				overlayText.style.display = 'initial';
				overlayText.textContent = 'No debug session is currently active.';
				rootNode = undefined;
				nodes.splice(0);
				disableInteractions = true;
				tooltip.elem.style.display = 'none';
				redrawCanvas();
			case 'theme':
				style = selectStyle();
				redrawCanvas();
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
		vscode.setState(state);

		if (rootNode !== undefined) {
			nodes.splice(0);
			fillNodes(rootNode);
			calcNodeBB(rootNode);
			calcNodePos(rootNode);
			redrawCanvas();
		}
	});
	if (needStateUpdate) {
		state.external = button?.className === 'toggle';
	}
	else {
		if (state.external) { button?.classList.toggle('toggle'); }
	}

	const autoFocusButton = document.getElementById('auto-focus-button');
	autoFocusButton?.addEventListener('click', (e) => {
		autoFocusButton.classList.toggle('toggle');

		state.autoFocus = !state.autoFocus;
		if (state.autoFocus) {
			scrollToActiveItem();
		}

		vscode.postMessage({
			command: 'updateState',
			data: state
		});
		vscode.setState(state);
	});
	if (needStateUpdate) {
		state.autoFocus = autoFocusButton?.className === 'toggle';
	}
	else {
		if (state.autoFocus) { autoFocusButton?.classList.toggle('toggle'); }
	}

	needStateUpdate = false;
}());
