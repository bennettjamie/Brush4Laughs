
import { runRefinement } from "../lib/processing/stages/refinement";
import { PreprocessResult, QuantizeResult, SegmentationResult } from "../lib/processing/types";

async function test() {
    console.log("Starting Debug Refinement...");

    const width = 100;
    const height = 100;

    // Mock Preprocess
    const preprocess: PreprocessResult = {
        width,
        height,
        data: Buffer.alloc(width * height * 4),
        info: { width, height, channels: 4 },
        faces: [], // Start empty
        mask: new Uint8Array(width * height),
        faceDetail: 50,
        bodyDetail: 50,
        bgDetail: 50
    };

    // Mock Quantize
    const centroids = [
        [0, 0, 0],       // 0: Black
        [255, 255, 255], // 1: White
        [255, 200, 180], // 2: Skin
    ];
    const quantize: QuantizeResult = {
        centroids,
        rawCentroids: centroids,
        oldToNewIdx: [0, 1, 2]
    };

    // Mock Segmentation
    const indexMap = new Int32Array(width * height);
    // Fill with random
    for (let i = 0; i < width * height; i++) {
        indexMap[i] = Math.floor(Math.random() * 3);
    }
    const segmentation: SegmentationResult = {
        indexMap,
        counts: [0, 0, 0], // Dummy
        totalOpaquePixels: width * height
    };

    try {
        console.log("Running refinement (No Faces)...");
        runRefinement(preprocess, quantize, segmentation, {
            pixelsPerMm: 5,
            mergeThresholdPixels: 20
        });
        console.log("Success (No Faces).");

        // Test WITH Faces
        console.log("Running refinement (With Faces)...");
        preprocess.faces = [{
            x: 20, y: 20, width: 40, height: 40, score: 0.9
        }];
        runRefinement(preprocess, quantize, segmentation, {
            pixelsPerMm: 5,
            mergeThresholdPixels: 20
        });
        console.log("Success (With Faces).");

    } catch (e) {
        console.error("CRASHED:", e);
    }
}

test();
