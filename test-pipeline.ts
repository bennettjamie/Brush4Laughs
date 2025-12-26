import { processImage } from "./lib/processing/pipeline";
import path from "path";

async function main() {
    const imgPath = "C:/Users/USER/.gemini/antigravity/brain/dde03006-3093-42da-9ff8-55e8ac8a2ff8/uploaded_image_1766538333506.png";
    console.log("Processing", imgPath);
    try {
        const result = await processImage(imgPath, 24, 5);
        console.log("Success:", result.outputUrl);
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
