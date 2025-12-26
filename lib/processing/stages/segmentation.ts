import { PreprocessResult, QuantizeResult, SegmentationResult } from "../types";

export function runSegmentation(
    preprocess: PreprocessResult,
    quantize: QuantizeResult
): SegmentationResult {
    const { data, width, height } = preprocess;
    const { rawCentroids, oldToNewIdx, centroids } = quantize;

    // Int32Array to store cluster indices
    let indexMap = new Int32Array(width * height);

    // Helper to find nearest centroid
    const findNearestIdx = (r: number, g: number, b: number) => {
        let minDist = Infinity;
        let idx = 0;
        for (let c = 0; c < rawCentroids.length; c++) {
            const val = rawCentroids[c];
            const dist = (r - val[0]) ** 2 + (g - val[1]) ** 2 + (b - val[2]) ** 2;
            if (dist < minDist) {
                minDist = dist;
                idx = c;
            }
        }
        return oldToNewIdx[idx]; // Return mapped index
    };

    // Pass 1: Build raw Index Map
    const counts = new Array(centroids.length).fill(0);
    let totalOpaquePixels = 0;

    for (let i = 0; i < width * height; i++) {
        const offset = i * 4;
        if (data[offset + 3] < 128) {
            indexMap[i] = -1;
            continue;
        }
        const idx = findNearestIdx(data[offset], data[offset + 1], data[offset + 2]);
        indexMap[i] = idx;
    }

    // Pass 1.5: Adaptive Morphological Smoothing
    // Reverted to Radius 1 (3x3) to restore facial features/eyes.
    const MODE_RADIUS = 1;
    const MODE_PASSES = 1;

    let smoothedIndexMap = new Int32Array(indexMap);
    for (let pass = 0; pass < MODE_PASSES; pass++) {
        const sourceMap = smoothedIndexMap.slice();
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = y * width + x;

                // SKIPPING SMOOTHING FOR FACES
                // If this pixel is inside a face, preservation is key.
                if (preprocess.faces) {
                    let inFace = false;
                    for (const f of preprocess.faces) {
                        if (x >= f.x && x <= f.x + f.width && y >= f.y && y <= f.y + f.height) {
                            inFace = true;
                            break;
                        }
                    }
                    if (inFace) {
                        smoothedIndexMap[i] = sourceMap[i]; // Keep original
                        continue;
                    }
                }

                // Optimization
                if (x > 2 && x < width - 3 && y > 2 && y < height - 3) {
                    const c = sourceMap[i];
                    if (sourceMap[i - 1] === c && sourceMap[i + 1] === c && sourceMap[i - width] === c && sourceMap[i + width] === c) {
                        continue;
                    }
                }

                const counts: Record<number, number> = {};
                let maxVal = 0;
                let maxIdx = sourceMap[i];

                for (let ky = -MODE_RADIUS; ky <= MODE_RADIUS; ky++) {
                    for (let kx = -MODE_RADIUS; kx <= MODE_RADIUS; kx++) {
                        const nx = x + kx;
                        const ny = y + ky;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const idx = sourceMap[ny * width + nx];
                            if (idx !== -1) {
                                counts[idx] = (counts[idx] || 0) + 1;
                                if (counts[idx] > maxVal) {
                                    maxVal = counts[idx];
                                    maxIdx = idx;
                                }
                            }
                        }
                    }
                }
                smoothedIndexMap[i] = maxIdx;
            }
        }
    }

    // Recalculate counts after smoothing
    return {
        indexMap: smoothedIndexMap,
        counts: new Array(centroids.length).fill(0), // Will be computed later
        totalOpaquePixels: 0
    };
}
