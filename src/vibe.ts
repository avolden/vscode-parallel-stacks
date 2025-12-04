// extension.ts

import * as vscode from 'vscode';

// A simplified mock of C/C++ parallel stack data
// In a real scenario, you'd fetch this from the active Debug Session's call stacks.
function getMockParallelStackData() {
    return [
        { id: 't1', name: 'Thread 1', frames: [{ func: 'main', file: 'a.cpp', line: 10 }, { func: 'A::run', file: 'a.cpp', line: 50 }, { func: 'B::wait', file: 'b.cpp', line: 100 }] },
        { id: 't2', name: 'Thread 2', frames: [{ func: 'main', file: 'a.cpp', line: 10 }, { func: 'A::run', file: 'a.cpp', line: 50 }, { func: 'C::calculate', file: 'c.cpp', line: 200 }] },
        { id: 't3', name: 'Thread 3', frames: [{ func: 'main', file: 'a.cpp', line: 10 }, { func: 'A::run', file: 'a.cpp', line: 50 }, { func: 'B::wait', file: 'b.cpp', line: 105 }, { func: 'E::process', file: 'e.cpp', line: 400 }] },
        { id: 't4', name: 'Thread 4', frames: [{ func: 'start_thread', file: 'sys.cpp', line: 5 }, { func: 'D::idle', file: 'd.cpp', line: 300 }] },
        { id: 't5', name: 'Thread 5', frames: [{ func: 'start_thread', file: 'sys.cpp', line: 5 }, { func: 'F::monitor', file: 'f.cpp', line: 500 }] },
    ];
}

export function vibe_activate(context: vscode.ExtensionContext) {
    let currentPanel: vscode.WebviewPanel | undefined = undefined;

    context.subscriptions.push(
        vscode.commands.registerCommand('thread-graph.show', () => {
            if (currentPanel) {
                currentPanel.reveal(vscode.ViewColumn.Two);
            } else {
                currentPanel = vscode.window.createWebviewPanel(
                    'parallelStacksCanvas', // Unique ID for this webview
                    'Parallel Stacks (C/C++)',
                    vscode.ViewColumn.Two,
                    {
                        enableScripts: true,
                        // Not strictly needed for canvas as we don't load external resources,
                        // but good practice if you later add images/fonts.
                        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')] 
                    }
                );

                currentPanel.webview.html = getWebviewContent(currentPanel.webview, context.extensionUri);

                // Handle messages from the webview
                currentPanel.webview.onDidReceiveMessage(message => {
                    switch (message.command) {
                        case 'ready':
                            // Send initial data to the webview once it's ready
                            updateWebview(currentPanel!);
                            break;
                        case 'selectFrame':
                            // In a real extension, you would use 'selectFrame' to tell VS Code's debugger
                            // to focus on the selected stack frame in the threads/call stack view.
                            vscode.window.showInformationMessage(`Selected frame: ${message.frame.func}`);
                            break;
                        case 'error':
                            vscode.window.showErrorMessage(`Webview Error: ${message.message}`);
                            break;
                    }
                }, undefined, context.subscriptions);

                currentPanel.onDidDispose(() => {
                    currentPanel = undefined;
                }, null, context.subscriptions);
            }
        })
    );

    // Placeholder: This is where you'd register to receive real stack data updates
    function updateWebview(panel: vscode.WebviewPanel) {
        // Send the data structure to the webview
        panel.webview.postMessage({
            command: 'updateData',
            data: getMockParallelStackData()
        });
    }

    // Example of updating the view when the debug state changes
    // context.subscriptions.push(vscode.debug.onDidChangeActiveDebugSession(() => updateWebview(currentPanel!)));
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
    // Note: All CSS and JavaScript must be INLINED in a dependency-free solution.
    // The webview's content security policy (CSP) should be adapted if you load external resources.
    // For this example, everything is self-contained.
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Parallel Stacks (Canvas)</title>
    <style>
        /* Minimalist CSS for the canvas container */
        body { margin: 0; padding: 0; overflow: auto; background-color: var(--vscode-editor-background); }
        #canvasContainer {
            position: relative;
            width: 100%;
            height: 100vh; /* Make it fill the viewport height */
            cursor: grab;
        }
        #parallelStacksCanvas {
            position: absolute;
            top: 0;
            left: 0;
            background-color: var(--vscode-editor-background);
        }
        /* VS Code theme variables for colors */
        :root {
            --node-background: var(--vscode-debugIcon-breakpointForeground);
            --node-text-color: var(--vscode-debugIcon-breakpointBackground);
            --node-border: var(--vscode-inputOption-activeBorder);
            --node-hover-background: var(--vscode-list-hoverBackground);
            --node-selected-border: var(--vscode-button-background);
            --arrow-color: var(--vscode-list-deemphasizedForeground);
            --thread-label-color: var(--vscode-list-deemphasizedForeground);
            --thread-label-background: var(--vscode-editorGroup-border);
        }
    </style>
</head>
<body>
    <div id="canvasContainer">
        <canvas id="parallelStacksCanvas"></canvas>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        // Canvas and Context
        const canvas = document.getElementById('parallelStacksCanvas');
        const ctx = canvas.getContext('2d');

        // Layout constants
        const NODE_WIDTH = 200;
        const NODE_HEIGHT = 28;
        const NODE_MARGIN_X = 50; // Horizontal space between stack levels
        const NODE_MARGIN_Y = 10; // Vertical space between nodes in the same level
        const THREAD_LABEL_HEIGHT = 20;
        const THREAD_LABEL_MARGIN = 5;
        const ARROW_HEAD_SIZE = 8;

        // Current view state for pan/zoom (simple pan for now)
        let translateX = 0;
        let translateY = 0;
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;

        // Store processed graph data
        let graphNodes = [];
        let graphEdges = [];
        let threadLabels = [];

        // Store selected node
        let selectedNode = null;

        // --- Event Listeners ---
        document.addEventListener('DOMContentLoaded', () => {
            vscode.postMessage({ command: 'ready' });
            resizeCanvas();
            window.addEventListener('resize', resizeCanvas);

            canvas.addEventListener('mousedown', onMouseDown);
            canvas.addEventListener('mousemove', onMouseMove);
            canvas.addEventListener('mouseup', onMouseUp);
            canvas.addEventListener('mouseout', onMouseUp); // End drag if mouse leaves canvas
            canvas.addEventListener('click', onClick);
        });

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            drawGraph(); // Redraw when resized
        }

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'updateData':
                    processAndLayoutGraph(message.data);
                    drawGraph();
                    break;
            }
        });

        function onMouseDown(e) {
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            canvas.style.cursor = 'grabbing';
        }

        function onMouseMove(e) {
            if (!isDragging) return;

            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;

            translateX += dx;
            translateY += dy;

            lastX = e.clientX;
            lastY = e.clientY;

            drawGraph();
        }

        function onMouseUp() {
            isDragging = false;
            canvas.style.cursor = 'grab';
        }

        function onClick(e) {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Adjust for current pan
            const worldX = mouseX - translateX;
            const worldY = mouseY - translateY;

            let clickedNode = null;
            for (const node of graphNodes) {
                if (worldX >= node.x && worldX <= node.x + NODE_WIDTH &&
                    worldY >= node.y && worldY <= node.y + NODE_HEIGHT) {
                    clickedNode = node;
                    break;
                }
            }

            if (clickedNode) {
                selectedNode = clickedNode;
                vscode.postMessage({
                    command: 'selectFrame',
                    frame: clickedNode.data
                });
                drawGraph(); // Redraw to show selection
            } else if (selectedNode) {
                selectedNode = null; // Deselect if click outside node
                drawGraph();
            }
        }


        // --- Graph Processing and Layout ---
        function processAndLayoutGraph(threadsData) {
            graphNodes = [];
            graphEdges = [];
            threadLabels = [];
            selectedNode = null; // Clear selection on new data

            const nodesByHash = new Map(); // Map to store unique stack frames
            const levels = []; // Array of arrays, each inner array is a level of nodes

            let globalNodeId = 0;

            // 1. Create unique nodes and establish parent-child relationships
            threadsData.forEach(thread => {
                let prevNode = null;
                threadLabels.push({
                    id: thread.id,
                    name: thread.name,
                    startNodeId: null // Will be filled in layout phase
                });

                thread.frames.forEach((frame, frameIndex) => {
                    const frameHash = \`\${frame.func}-\${frame.file}-\${frame.line}\`;
                    let node = nodesByHash.get(frameHash);

                    if (!node) {
                        node = {
                            id: \`node_\${globalNodeId++}\`,
                            data: frame, // Original frame data
                            level: frameIndex,
                            threadIds: new Set(), // Which threads pass through this node
                            parents: new Set(),
                            children: new Set(),
                            x: 0, y: 0, // Will be calculated in layout
                            width: NODE_WIDTH, height: NODE_HEIGHT
                        };
                        nodesByHash.set(frameHash, node);
                        graphNodes.push(node);

                        if (!levels[frameIndex]) {
                            levels[frameIndex] = [];
                        }
                        levels[frameIndex].push(node);
                    }
                    node.threadIds.add(thread.id);

                    if (prevNode) {
                        prevNode.children.add(node.id);
                        node.parents.add(prevNode.id);
                        graphEdges.push({ source: prevNode.id, target: node.id });
                    } else {
                         // This is the root node for this thread
                         threadLabels[threadLabels.length - 1].startNodeId = node.id;
                    }
                    prevNode = node;
                });
            });

            // 2. Simple Hierarchical Layout
            // Position nodes level by level
            let currentX = NODE_MARGIN_X;
            levels.forEach((levelNodes, levelIndex) => {
                let currentY = NODE_MARGIN_Y;
                
                // Sort nodes within a level for some consistency
                levelNodes.sort((a, b) => a.data.func.localeCompare(b.data.func));

                levelNodes.forEach(node => {
                    node.x = currentX;
                    node.y = currentY;
                    currentY += NODE_HEIGHT + NODE_MARGIN_Y;
                });
                currentX += NODE_WIDTH + NODE_MARGIN_X;
            });

            // For thread labels, find their starting node and position it above
            threadLabels.forEach(label => {
                const startNode = graphNodes.find(n => n.id === label.startNodeId);
                if (startNode) {
                    label.x = startNode.x;
                    label.y = startNode.y - THREAD_LABEL_HEIGHT - THREAD_LABEL_MARGIN;
                    label.width = NODE_WIDTH;
                    label.height = THREAD_LABEL_HEIGHT;
                }
            });
            
            // Adjust canvas size if content exceeds current view
            const contentWidth = currentX + NODE_MARGIN_X;
            const contentHeight = Math.max(...graphNodes.map(n => n.y + n.height)) + NODE_MARGIN_Y;
            canvas.width = Math.max(window.innerWidth, contentWidth + Math.abs(translateX));
            canvas.height = Math.max(window.innerHeight, contentHeight + Math.abs(translateY));
        }


        // --- Canvas Drawing ---
        function drawGraph() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.save();
            ctx.translate(translateX, translateY);

            // Draw edges first (so nodes are on top)
            graphEdges.forEach(edge => {
                const sourceNode = graphNodes.find(n => n.id === edge.source);
                const targetNode = graphNodes.find(n => n.id === edge.target);

                if (sourceNode && targetNode) {
                    drawArrow(sourceNode, targetNode);
                }
            });

            // Draw thread labels
            threadLabels.forEach(label => {
                ctx.fillStyle = 'var(--thread-label-background)';
                ctx.fillRect(label.x, label.y, label.width, label.height);
                ctx.fillStyle = 'var(--thread-label-color)';
                ctx.font = '10px sans-serif';
                ctx.fillText(label.name, label.x + 5, label.y + THREAD_LABEL_HEIGHT / 2 + 3); // Center text
            });

            // Draw nodes
            graphNodes.forEach(node => {
                drawNode(node);
            });

            ctx.restore();
        }

        function drawNode(node) {
            const isSelected = selectedNode && selectedNode.id === node.id;

            // Node background
            ctx.fillStyle = isSelected ? 'var(--node-selected-border)' : 'var(--node-background)';
            ctx.fillRect(node.x, node.y, node.width, node.height);

            // Node border (optional, if you want a different border color)
            // ctx.strokeStyle = 'var(--node-border)';
            // ctx.strokeRect(node.x, node.y, node.width, node.height);

            // Node text
            ctx.fillStyle = 'var(--node-text-color)';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            let text = node.data.func;
            // Truncate if too long
            if (ctx.measureText(text).width > NODE_WIDTH - 10) {
                text = text.substring(0, Math.floor((NODE_WIDTH - 10) / 7)) + '...'; // Approximation
            }
            ctx.fillText(text, node.x + 5, node.y + NODE_HEIGHT / 2);
        }

        function drawArrow(source, target) {
            ctx.strokeStyle = 'var(--arrow-color)';
            ctx.lineWidth = 1;

            // Start point (right middle of source node)
            const startX = source.x + source.width;
            const startY = source.y + source.height / 2;

            // End point (left middle of target node)
            const endX = target.x;
            const endY = target.y + target.height / 2;

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            
            // Simple straight line for now. For more complex routing, consider
            // A* or other pathfinding, but that's beyond "no dependencies."
            ctx.lineTo(endX, endY);
            ctx.stroke();

            // Draw arrow head
            const angle = Math.atan2(endY - startY, endX - startX);
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX - ARROW_HEAD_SIZE * Math.cos(angle - Math.PI / 6), endY - ARROW_HEAD_SIZE * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX - ARROW_HEAD_SIZE * Math.cos(angle + Math.PI / 6), endY - ARROW_HEAD_SIZE * Math.sin(angle + Math.PI / 6));
            ctx.stroke();
        }

    </script>
</body>
</html>`;
}