// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

(function () {

	const vscode = acquireVsCodeApi();

	let threadsData = Array();
    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.command) {
            case 'threads':
				for (var i = 0; i < threadsData.length; i++) {
					document.documentElement.removeChild(threadsData[i]);
				}
				threadsData = [];
                for (var i = 0; i < message.threads.length; i++) {
					var elem = document.createElement('p')
					elem.textContent = message.threads[i].id.toString();
					elem.className = 'ababa';
					document.documentElement.appendChild(elem);
					threadsData.push(elem);

					for (const frame of message.threads[i].frames) {
						var frameElem = document.createElement('div');
						frameElem.textContent = frame.fn;
						elem.appendChild(frameElem);
					}
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

	const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('thread-canvas'));
	if (canvas) {
		const ctx = canvas.getContext('2d');
		if (ctx) {
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
			}

			/**
			 * @param {MouseEvent} e
			 */
			function stopMove(e) {
				moving = false;
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

				slider.scrollLeft = newScroll.x;
				slider.scrollTop = newScroll.y;
			}

			function resizeCanvas() {
				console.log('w: ' + window.innerWidth);
				console.log('h: ' + window.innerHeight);
				// TODO Resize to content
				canvas.width = 2000;
				canvas.height = 2000;
			}

			function drawGraph() {
				if (!ctx) {
					return;
				}

				ctx.clearRect(0, 0, canvas.width, canvas.height);

				for (var i = 0; i < 10; ++i) {
					var posx = 15 + 300*i;
					for (var j = 0; j < 10; ++j) {
						var posy = 15 + 300*j;
						ctx.fillStyle = 'white';
						ctx.font = getComputedStyle(canvas).getPropertyValue('--vscode-editor-font-size') + ' ' + getComputedStyle(canvas).getPropertyValue('--vscode-editor-font-family');
						ctx.textBaseline = 'middle';
						ctx.fillText("ABABAB", posx + 15, posy + 15, 190);
						ctx.strokeStyle = 'grey'
						ctx.lineWidth = 1;
						ctx.strokeRect(posx, posy, 200, 200);
						ctx.beginPath();
						ctx.moveTo(posx, 45);
						ctx.lineTo(posx + 200, 45)
						ctx.stroke();
					}
				}

				ctx.strokeRect(1815, 1815, 200, 200);
			}

			document.addEventListener('DOMContentLoaded', () => {
				resizeCanvas();
				window.addEventListener('resize', resizeCanvas);

				canvas.addEventListener('mousedown', startMove);
				canvas.addEventListener('mousemove', move);
				canvas.addEventListener('mouseup', stopMove);
				canvas.addEventListener('mouseout', stopMove); // End drag if mouse leaves canvas
				// canvas.addEventListener('click', onClick);

				drawGraph();
	        });

		}
	}
}());
