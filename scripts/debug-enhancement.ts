
import { enhanceFaces } from "../lib/processing/stages/enhancement";
import { FaceBox } from "../lib/processing/stages/faces";

async function test() {
    console.log("Starting Debug Enhancement...");

    const width = 100;
    const height = 100;
    const data = new Uint8ClampedArray(width * height * 4);
    // Fill with noise
    for (let i = 0; i < data.length; i++) data[i] = Math.floor(Math.random() * 255);

    const faces: FaceBox[] = [{
        x: 20, y: 20, width: 40, height: 40, score: 0.9
    }];

    try {
        console.log("Running enhanceFaces...");
        await enhanceFaces(data, width, height, faces);
        console.log("Success (enhanceFaces).");
    } catch (e) {
        console.error("CRASHED:", e);
    }
}

test();
