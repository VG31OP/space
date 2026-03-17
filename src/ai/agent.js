import { Ollama } from "@langchain/ollama";
import { PromptTemplate } from "@langchain/core/prompts";
import * as Cesium from "cesium";

// For local proxy, user must have Ollama running with e.g., 'llama3' or 'mistral'
// CORS must be enabled in Ollama (OLLAMA_ORIGINS="*")
const llm = new Ollama({
    baseUrl: "http://localhost:11434", // Default Ollama port
    model: "llama3", // Assuming user has a modern lightweight model like llama3 or mistral
    temperature: 0.1, // Low temp for deterministic command parsing
});

const prompt = PromptTemplate.fromTemplate(`
You are the AI core for WorldView, a tactical geospatial OSINT dashboard.
User Command: {command}

Analyze the command and output ONLY a JSON object representing the action to take. 
Do not include any other text, markdown blocks, or explanation. Just the raw JSON.

Available actions:
1. "flyTo": Move the camera to a location. Requires 'lat', 'lng', and optionally 'alt' (default 100000).
2. "setMode": Change the visual shader suite. Mode can be 'normal', 'flir', 'nvg', or 'crt'.

Example 1:
User: "Show me New York"
Output: {{"action": "flyTo", "lat": 40.7128, "lng": -74.0060, "alt": 100000}}

Example 2:
User: "Engage thermal optics"
Output: {{"action": "setMode", "mode": "flir"}}

Example 3:
User: "Look at coordinates 48.8566 North, 2.3522 East"
Output: {{"action": "flyTo", "lat": 48.8566, "lng": 2.3522, "alt": 50000}}

Output ONLY valid parseable JSON.
`);

export async function processNatureLanguageCommand(commandText, viewer, appState) {
    try {
        const formattedPrompt = await prompt.format({ command: commandText });
        const responseText = await llm.invoke(formattedPrompt);

        // Parse the JSON
        // Ollama might wrap it in markdown or add text, so we do a resilient parse
        const jsonMatch = responseText.match(/\\{.*\\}/s) || [responseText];
        const actionData = JSON.parse(jsonMatch[0].trim());

        executeAction(actionData, viewer, appState);
        return `Command accepted: ${actionData.action}`;

    } catch (error) {
        return "Error: Command not recognized or Ollama is offline.";
    }
}

function executeAction(actionData, viewer, appState) {
    if (actionData.action === 'flyTo') {
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
                actionData.lng,
                actionData.lat,
                actionData.alt || 100000
            ),
            duration: 2.0
        });
    } else if (actionData.action === 'setMode') {
        // Dispatch an event or directly click the button to keep UI in sync
        const btn = document.querySelector(`.filter-btn[data-mode="${actionData.mode}"]`);
        if (btn) btn.click();
    }
}
