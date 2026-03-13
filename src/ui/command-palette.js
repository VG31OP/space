import { processNatureLanguageCommand } from '../ai/agent.js';
import { analyzeCurrentView } from '../ai/vision.js';

export function initCommandPalette(viewer, appState) {
    const inputEl = document.getElementById('commandInput');
    const responseEl = document.getElementById('aiResponse');

    if (!inputEl || !responseEl) return;

    inputEl.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && inputEl.value.trim() !== '') {
            const command = inputEl.value.trim();
            inputEl.value = '';

            responseEl.textContent = `PROCESSING COMMAND: "${command}"...`;
            responseEl.style.color = '#ffaa00';

            try {
                if (command.toLowerCase().includes('analyze view')) {
                    responseEl.textContent = '[SYSTEM] Transmitting canvas to Visual Language Model...';
                    const result = await analyzeCurrentView(viewer);
                    responseEl.textContent = `[VLM ANALYSIS] ${result}`;
                    responseEl.style.color = '#00ff88';
                } else {
                    const result = await processNatureLanguageCommand(command, viewer, appState);
                    responseEl.textContent = `[SYSTEM] ${result}`;
                    responseEl.style.color = '#00ff88';
                }
            } catch (err) {
                responseEl.textContent = `[ERROR] ${err.message || err}`;
                responseEl.style.color = '#ff3333';
            }
        }
    });

    // Focus command palette on '/'
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== inputEl) {
            e.preventDefault();
            inputEl.focus();
        }
    });

    console.log('Command Palette initialized. Press / to focus.');
}
