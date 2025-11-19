// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

(function () {

	const vscode = acquireVsCodeApi();
    // const oldState = /** @type {{ count: number} | undefined} */ (vscode.getState());

    // const counter = /** @type {HTMLElement} */ (document.getElementById('lines-of-code-counter'));
    // console.log('Initial state', oldState);

    // let currentCount = (oldState && oldState.count) || 0;
    // counter.textContent = `${currentCount}`;

    // setInterval(() => {
    //     counter.textContent = `${currentCount++} `;
    // }, 100);

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

	console.log(button);
	button?.addEventListener('click', () => {
		console.log('update');
		vscode.postMessage({
			command: 'update'
		});
	})
}());
