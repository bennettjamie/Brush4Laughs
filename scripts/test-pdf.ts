
import { generateGuidePDF } from "../lib/pdf/guide";
import fs from "fs/promises";
import path from "path";

async function test() {
    console.log("Starting Guide PDF Test (Complex)...");
    try {
        const doc = await generateGuidePDF({
            posterizedUrl: "/uploads/0632e182-ce64-464c-a509-f8b6300fff0a.png",
            originalUrl: "/uploads/0632e182-ce64-464c-a509-f8b6300fff0a.png",
            palette: [
                { color: "#0047AB", name: "Cobalt Blue", amount: 10, percentage: 10 }, // Exact Match
                { color: "#00FF00", name: "Lime Green", amount: 10, percentage: 10 }, // Mix
                { color: "#ABCDEF", name: "Pale Blue", amount: 5, percentage: 5 }, // Mix
                { color: "#C76114", name: "Raw Sienna", amount: 5, percentage: 5 }, // Exact match
            ],
            unit: "ml"
        });

        console.log("PDF Generated. Saving...");
        const buffer = Buffer.from(doc.output("arraybuffer"));
        await fs.writeFile("test-guide-complex.pdf", buffer);
        console.log("Success! Saved to test-guide-complex.pdf");
    } catch (e) {
        console.error("FAILED:", e);
    }
}

test();
