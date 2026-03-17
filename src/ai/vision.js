import { Ollama } from "@langchain/ollama";
import * as Cesium from 'cesium';

// VLM config for image analysis using Ollama (e.g. llava or moondream)
const vlm = new Ollama({
    baseUrl: "http://localhost:11434",
    model: "llava", // User needs llava or another vision model pulled
    temperature: 0.2
});

export async function analyzeCurrentView(viewer) {
    return new Promise((resolve, reject) => {
        // We must grab the canvas immediately after a render pass to ensure it's not empty WebGL buffer
        viewer.scene.render();

        const canvas = viewer.canvas;

        // Convert to base64
        // Note: for a large canvas, scaling it down first is better for Ollama performance, but we'll use direct for simplicity
        const base64Image = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];

        const prompt = "You are a geospatial intelligence analyst. Examine this tactical satellite/drone view. Describe any notable features, UI elements, or potential targets visible.";

        console.log("Transmitting visual intercept to VLM...");

        // The LangChain Ollama wrapper requires images as base64 array in the options payload for older versions,
        // or through the HumanMessage + image_url for ChatOllama. We are using standard LLM interface:
        vlm.invoke(prompt, { images: [base64Image] })
            .then(res => {
                resolve(res.trim());
            })
            .catch(err => {
                reject("Vision analysis failed. Ensure Ollama is running with 'llava' model.");
            });
    });
}
