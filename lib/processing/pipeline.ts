import "server-only";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import nearestColor from "nearest-color";
import { paintcolors } from "../colors";

// Stages
import { runPreprocess } from "./stages/preprocess";
import { runQuantize } from "./stages/quantize";
import { runSegmentation } from "./stages/segmentation";
import { runRefinement } from "./stages/refinement";
import { runVectorization } from "./stages/vectorization";
import { runLabeling } from "./stages/labeling";
import { runFaceDetection } from "./stages/faces";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// Setup nearest color (Global)
const colorMap = nearestColor.from(
    paintcolors.reduce((acc, curr) => ({ ...acc, [curr.name]: curr.hex }), {})
);

export async function processImage(
    imagePath: string,
    numColors: number,
    complexity: number = 5,
    customDim?: { width: number, height: number },
    options?: { faceDetail?: number; bodyDetail?: number; bgDetail?: number; textDetail?: number; bgOpacity?: number }
): Promise<{
    outputUrl: string;
    outlineUrl: string;
    palette: { color: string; name: string; amount: number; percentage: number }[];
    labels: { x: number; y: number; index: number; light?: boolean; fontSize?: number }[];
    dimensions: { width: number; height: number };
}> {
    console.time("TotalPipeline");

    // 1. Preprocess (Load Image & Resize)
    console.time("Preprocess");
    const preprocess = await runPreprocess({ imagePath, numColors, complexity, customDim, ...options });
    console.timeEnd("Preprocess");
    const { width, height, data } = preprocess;

    console.log(`[Pipeline] Input: ${width}x${height}`);

    // 1.5 Face Detection & Subject Masking
    let mask: Uint8Array | null = null;
    console.time("FaceDetection");
    try {
        const detection = await runFaceDetection(preprocess);
        preprocess.faces = detection.faces;
        mask = detection.mask;
        preprocess.mask = mask || undefined;

        if (detection.faces.length > 0) {
            console.log(`[FaceDetection] Found ${detection.faces.length} faces.`);
        }
        if (mask) {
            console.log(`[Segmentation] Generated Subject Mask.`);
        }
    } catch (e) {
        console.warn("[FaceDetection] Failed:", e);
    }
    console.timeEnd("FaceDetection");

    // 1.6 Text Detection
    console.time("TextDetection");
    try {
        // Lazy load to prevent top-level impact
        const { runTextDetection } = require("./stages/text");
        console.log("[Pipeline] Running Text Detection...");
        const textResults = await runTextDetection(preprocess);
        preprocess.text = textResults;
    } catch (e) {
        // Non-fatal error: Log and continue so the user still gets a result
        console.warn("[TextDetection] Failed (Skipping text optimization):", e);
    }
    console.timeEnd("TextDetection");

    // 2. ENHANCE FACES (Hyper-Contrast)
    // We modify the data in-place to force high contrast on features
    if (mask && preprocess.faces && preprocess.faces.length > 0) {
        // Dynamic import to avoid cycles? No, it's a leaf node.
        const { enhanceFaces } = require("./stages/enhancement");
        console.log("[Pipeline] Enhancing Faces (Contrast + Sharpen)...");
        enhanceFaces(preprocess.data, width, height, preprocess.faces);
    }

    // 3. Dual-Pass Logic
    // If we have a mask, we split processing. If not, we fall back to single pass.
    let finalCentroids: number[][] = [];
    let finalIndexMap: Int32Array = new Int32Array(width * height).fill(-1);
    let totalOpaquePixels = 0;

    if (mask && preprocess.faces && preprocess.faces.length > 0) {
        console.log("[Pipeline] Mode: Dual-Pass (Subject-First)");

        // A. Budgeting
        // Guarantee at least 8 colors for subject, or 50%
        const subjectColorCount = Math.max(8, Math.floor(numColors * 0.5));
        const bgColorCount = Math.max(2, numColors - subjectColorCount);
        console.log(`[Pipeline] Budget: Subject=${subjectColorCount}, BG=${bgColorCount}`);

        // B. Split Buffers
        const subjectData = Buffer.from(data);
        const bgData = Buffer.from(data);

        for (let i = 0; i < width * height; i++) {
            const isSubject = mask[i] === 1;
            const idx = i * 4;
            // If Subject, make BG transparent
            if (isSubject) {
                bgData[idx + 3] = 0;
            } else {
                subjectData[idx + 3] = 0;
            }
        }

        const subjectPreprocess = { ...preprocess, data: subjectData };
        // Remove faces from BG preprocess so it doesn't try to anchor them
        const bgPreprocess = { ...preprocess, data: bgData, faces: [] };

        // C. Process Subject
        console.log("[Pipeline] Processing Subject...");
        const subjectQuantize = runQuantize(subjectPreprocess, subjectColorCount);
        const subjectSeg = runSegmentation(subjectPreprocess, subjectQuantize);

        // D. Process Background
        console.log("[Pipeline] Processing Background...");
        const bgQuantize = runQuantize(bgPreprocess, bgColorCount);
        const bgSeg = runSegmentation(bgPreprocess, bgQuantize);

        // E. Merge
        finalCentroids = [...subjectQuantize.centroids, ...bgQuantize.centroids];
        const subjectOffset = 0; // index map starts at 0
        const bgOffset = subjectQuantize.centroids.length;

        for (let i = 0; i < width * height; i++) {
            if (data[i * 4 + 3] < 128) continue; // Original transparent

            totalOpaquePixels++;

            if (mask[i] === 1) {
                // Subject
                const idx = subjectSeg.indexMap[i];
                if (idx !== -1) finalIndexMap[i] = idx + subjectOffset;
            } else {
                // Background
                const idx = bgSeg.indexMap[i];
                if (idx !== -1) finalIndexMap[i] = idx + bgOffset;
            }
        }

    } else {
        console.log("[Pipeline] Mode: Single-Pass (Standard)");
        const quantize = runQuantize(preprocess, numColors);
        const seg = runSegmentation(preprocess, quantize);
        finalCentroids = quantize.centroids;
        finalIndexMap = seg.indexMap;
        totalOpaquePixels = seg.totalOpaquePixels;
    }

    // Reconstruction of "Quantize" and "Segmentation" objects for downstream
    // Downstream (Refinement/Vectorization) expects these objects.
    const mergedQuantize = {
        centroids: finalCentroids,
        rawCentroids: finalCentroids,
        oldToNewIdx: finalCentroids.map((_, i) => i)
    };

    const mergedSegmentation = {
        indexMap: finalIndexMap,
        counts: new Array(finalCentroids.length).fill(0), // Will be recalculated or used?
        totalOpaquePixels: totalOpaquePixels
    };

    // Recalculate counts
    for (let i = 0; i < finalIndexMap.length; i++) {
        const idx = finalIndexMap[i];
        if (idx !== -1) mergedSegmentation.counts[idx]++;
    }

    // 4. Refinement (Merging, Sliver Removal)
    const targetInches = customDim?.width || 20;
    const pixelsPerMm = preprocess.width / (targetInches * 25.4);
    const MIN_REGION_MM2 = 10;
    const mergeThresholdPixels = Math.round(MIN_REGION_MM2 * (pixelsPerMm ** 2));

    console.time("Refinement");
    runRefinement(preprocess, mergedQuantize, mergedSegmentation, {
        pixelsPerMm,
        mergeThresholdPixels
    });
    console.timeEnd("Refinement");

    // 5. Vectorization (Posterize + Outline)
    console.time("Vectorization");
    const vectorization = runVectorization(preprocess, mergedQuantize, mergedSegmentation, { bgOpacity: options?.bgOpacity });
    console.timeEnd("Vectorization");

    // 6. Labeling (Optimized)
    console.time("Labeling");
    const { labels, maxRegion } = runLabeling(mergedSegmentation, width, height);
    console.timeEnd("Labeling");

    // 7. Output Generation & IO
    const resultId = randomUUID();
    const posterizedFilename = `processed-${resultId}.png`;
    const outlineFilename = `outline-${resultId}.png`;

    // Save Posterized
    await sharp(vectorization.posterizedData, { raw: { width, height, channels: 4 } })
        .png()
        .toFile(path.join(UPLOAD_DIR, posterizedFilename));

    // Prepare Outline
    let outlinePipe = sharp(vectorization.outlineData, { raw: { width, height, channels: 4 } }).png();
    await outlinePipe.toFile(path.join(UPLOAD_DIR, outlineFilename));

    // 8. Build Rich Palette
    const palette = mergedQuantize.centroids.map((c, i) => {
        const hex = "#" + [c[0], c[1], c[2]].map(x => {
            const h = Math.round(x).toString(16);
            return h.length === 1 ? "0" + h : h;
        }).join("");

        const match = colorMap(hex);
        const count = vectorization.counts[i];
        const percentage = (count / vectorization.totalOpaquePixels) * 100; // 0-100 scale

        // Calculate Physical Volume
        const areaMm2 = count / (pixelsPerMm * pixelsPerMm);
        const areaCm2 = areaMm2 / 100;
        // Conservative coverage (thick application)
        const COVERAGE_CM2_PER_ML = 10;
        // Safety Factor 2.5 (+150% buffer) to ensure they have enough paint
        let estimatedMl = (areaCm2 / COVERAGE_CM2_PER_ML) * 2.5;
        estimatedMl = Math.max(0.5, estimatedMl);

        return {
            color: hex,
            name: match ? match.name : "Custom",
            percentage: percentage,
            amount: estimatedMl,
        };
    });

    console.timeEnd("TotalPipeline");
    return {
        outputUrl: `/uploads/${posterizedFilename}`,
        outlineUrl: `/uploads/${outlineFilename}`,
        palette,
        labels,
        dimensions: { width, height }
    };
}
