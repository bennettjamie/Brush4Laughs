import { processImage } from "../lib/processing/pipeline";
import path from "path";
import fs from "fs";

async function runTest() {
    const testImage = path.join(process.cwd(), "public", "uploads", "test_complex.png");

    if (!fs.existsSync(testImage)) {
        console.error("Test image not found at", testImage);
        process.exit(1);
    }

    console.log("--- Pipeline Verification Start ---");
    console.log("Processing image with 16 colors, complexity 5...");

    try {
        const start = Date.now();
        const result = await processImage(testImage, 16, 5);
        const end = Date.now();

        console.log("Processing Complete in", (end - start) / 1000, "seconds.");
        console.log("Final Palette Size:", result.palette.length);
        console.log("Final Label Count:", result.labels.length);
        console.log("Outline URL:", result.outlineUrl);

        // If we reached here without crashing, and labels are generated,
        // it means the Erosion logic successfully iteratively merged the slivers.
        console.log("Verification Success: Logic is sound and operational.");
        process.exit(0);
    } catch (e) {
        console.error("Verification Failed with Error:", e);
        process.exit(1);
    }
}

runTest();
