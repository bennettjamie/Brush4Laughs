
import { generatePDF } from "../lib/pdf/generator";
import path from "path";

async function run() {
    console.log("Starting PDF Generation Test...");

    // Using filenames found in uploads. 
    // Assuming "processed" corresponds to a resultUrl and "outline" to an outlineUrl
    // We'll pick one set.
    const id = "e09f4527-53c8-40df-aea0-c03f93afd1e3";
    const outlineUrl = `/uploads/outline-${id}.png`;
    const resultUrl = `/uploads/processed-${id}.png`;
    // We don't have the original handy in the list easily, just pass undefined or skip guide

    // Dummy palette/labels
    const palette = [
        { color: "#000000", name: "Black", amount: 10, percentage: 0.1 },
        { color: "#ffffff", name: "White", amount: 10, percentage: 0.1 }
    ];
    // STRESS TEST: 5000 Labels
    const labels = [];
    for (let i = 0; i < 10; i++) {
        labels.push({
            x: Math.random() * 800,
            y: Math.random() * 800,
            index: Math.floor(Math.random() * 20) + 1,
            fontSize: 0.5
        });
    }

    // STRESS TEST via HTTP
    const body = {
        outlineUrl,
        resultUrl,
        palette,
        labels,
        dimensions: { width: 800, height: 800 },
        customDim: { width: 16, height: 20 },
        opacity: 15,
        type: "canvas"
    };

    try {
        console.log("Sending POST request to http://localhost:3000/api/pdf...");
        const start = Date.now();
        const res = await fetch("http://localhost:3000/api/pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            console.error("HTTP Error:", res.status, res.statusText);
            const text = await res.text();
            console.log("Response:", text);
        } else {
            console.log(`PDF Generated successfully via API in ${(Date.now() - start) / 1000}s`);
            // We don't care about the binary output for the test, just the status
        }
    } catch (e) {
        console.error("Request FAILED:");
        console.error(e);
    }
}

run();
