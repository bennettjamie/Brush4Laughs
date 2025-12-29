import { PreprocessResult, QuantizeResult, SegmentationResult } from "../types";

export interface VectorizationResult {
    posterizedData: Buffer;
    outlineData: Buffer;
    counts: number[];
    totalOpaquePixels: number;
}

export function runVectorization(
    preprocess: PreprocessResult,
    quantize: QuantizeResult,
    segmentation: SegmentationResult,
    options?: { bgOpacity?: number }
): VectorizationResult {
    const { width, height } = preprocess;
    const { centroids } = quantize;
    const { indexMap } = segmentation;
    const bgOpacity = options?.bgOpacity ?? 0.1; // Default 10%

    const posterizedData = Buffer.alloc(width * height * 4);
    const outlineData = Buffer.alloc(width * height * 4);

    // Counts need to be recalculated now that merging is done
    const counts = new Array(centroids.length).fill(0);
    let totalOpaquePixels = 0;

    const ColorDist = (c1: number[], c2: number[]) => Math.sqrt((c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2 + (c1[2] - c2[2]) ** 2);

    const isHumanTone = (rgb: number[]) => {
        const [r, g, b] = rgb;
        return r > 50 && g > 30 && b > 20 && r > g && g > b && (r - b) > 20;
    };

    const EDGE_BLEND_THRESHOLD = 25; // Lowered to catch more subtle transitions

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            const myIdx = indexMap[i];
            const offset = i * 4;

            if (myIdx === -1) {
                outlineData[offset + 3] = 0;
                posterizedData[offset + 3] = 0;
                continue;
            }

            // Fill Posterized
            const color = centroids[myIdx];
            posterizedData[offset] = Math.round(color[0]);
            posterizedData[offset + 1] = Math.round(color[1]);
            posterizedData[offset + 2] = Math.round(color[2]);
            posterizedData[offset + 3] = 255;

            counts[myIdx]++;
            totalOpaquePixels++;

            // Edge Logic
            let isEdge = false;
            let neighborIdx = -1;

            // Check Right and Down for boundary
            if (x < width - 1) {
                if (indexMap[i + 1] !== myIdx && indexMap[i + 1] !== -1) {
                    isEdge = true; neighborIdx = indexMap[i + 1];
                }
            }
            if (!isEdge && y < height - 1) {
                if (indexMap[i + width] !== myIdx && indexMap[i + width] !== -1) {
                    isEdge = true; neighborIdx = indexMap[i + width];
                }
            }

            if (isEdge) {
                const c1 = centroids[myIdx];
                const c2 = centroids[neighborIdx];
                const dist = ColorDist(c1, c2);

                // --- ADAPTIVE THRESHOLDING ---
                // Quality of outline depends on LOCATION.
                let threshold = EDGE_BLEND_THRESHOLD;
                let forceSolid = false;

                // Check Face/Subject Region
                let inSubject = false;
                if (preprocess.faces) {
                    const cx = x;
                    const cy = y;
                    for (const f of preprocess.faces) {
                        // Expand slightly
                        const pad = Math.min(f.width, f.height) * 0.1;
                        if (cx >= f.x - pad && cx <= f.x + f.width + pad && cy >= f.y - pad && cy <= f.y + f.height + pad) {
                            inSubject = true;
                            break;
                        }
                    }
                }

                // Also Center safely
                const cx = width / 2; const cy = height / 2;
                if ((x - cx) ** 2 + (y - cy) ** 2 < (Math.min(width, height) * 0.25) ** 2) {
                    inSubject = true;
                }

                if (inSubject) {
                    threshold = 5; // HYPER SENSITIVE for faces/bodies
                    forceSolid = true;
                }

                // Decision
                const isSignificant = dist > threshold;
                const isHuman = isHumanTone(c1) || isHumanTone(c2);

                if (isSignificant || (inSubject && dist > 3)) {
                    // Draw Line
                    if (isHuman || forceSolid || dist > 40) {
                        // SOLID
                        outlineData[offset] = 45;
                        outlineData[offset + 1] = 45;
                        outlineData[offset + 2] = 45;
                        outlineData[offset + 3] = 255;
                    } else {
                        // DOTTED (Background blending)
                        if ((x + y) % 6 < 3) {
                            outlineData[offset] = 100;
                            outlineData[offset + 1] = 100;
                            outlineData[offset + 2] = 100;
                            outlineData[offset + 3] = 255;
                        } else {
                            outlineData[offset + 3] = 0;
                        }
                    }
                } else {
                    // NO LINE -> BLEND GHOST COLOR
                    const c = centroids[myIdx];
                    outlineData[offset] = Math.round(c[0]);
                    outlineData[offset + 1] = Math.round(c[1]);
                    outlineData[offset + 2] = Math.round(c[2]);
                    outlineData[offset + 3] = Math.round(255 * bgOpacity);
                }

            } else {
                // NO EDGE -> BLEND GHOST COLOR
                // This ensures the whole canvas is filled with faint color
                const c = centroids[myIdx];
                outlineData[offset] = Math.round(c[0]);
                outlineData[offset + 1] = Math.round(c[1]);
                outlineData[offset + 2] = Math.round(c[2]);
                outlineData[offset + 3] = Math.round(255 * bgOpacity);
            }
        }
    }

    return {
        posterizedData,
        outlineData,
        counts,
        totalOpaquePixels
    };
}
