import { PreprocessResult, QuantizeResult, SegmentationResult } from "../types";

export function runRefinement(
    preprocess: PreprocessResult,
    quantize: QuantizeResult,
    segmentation: SegmentationResult,
    options: {
        pixelsPerMm: number;
        mergeThresholdPixels: number;
    }
): void {
    const { width, height } = preprocess;
    const { centroids } = quantize;
    const { indexMap } = segmentation;
    const { mergeThresholdPixels } = options;

    // Pass 1.6: Contrast-Aware Region Merging
    const ColorDist = (c1: number[], c2: number[]) => Math.sqrt((c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2 + (c1[2] - c2[2]) ** 2);

    // Helper: Skin Tone Detection (Approximate)
    // Warm colors: R > G > B, significant saturation
    const isSkinTone = (rgb: number[]) => {
        const [r, g, b] = rgb;
        return r > 60 && g > 40 && b > 20 && r > g && r > b && (r - Math.min(g, b)) > 15 && Math.abs(r - g) < 60;
    };

    // Reduced passes to 3 for stability while maintaining quality.
    for (let pass = 0; pass < 3; pass++) {
        let visitedMerge = new Uint8Array(width * height);
        let changed = false;

        for (let i = 0; i < width * height; i++) {
            if (visitedMerge[i] || indexMap[i] === -1) continue;

            const rootIdx = indexMap[i];
            const region = [i];
            visitedMerge[i] = 1;

            let head = 0;
            while (head < region.length) {
                const curr = region[head++];
                const cx = curr % width;
                const cy = Math.floor(curr / width);
                const neighbors = [curr + 1, curr - 1, curr + width, curr - width];
                for (let n of neighbors) {
                    const nx = n % width;
                    const ny = Math.floor(n / width);
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height && Math.abs(nx - cx) + Math.abs(ny - cy) === 1) {
                        if (visitedMerge[n] === 0 && indexMap[n] === rootIdx) {
                            visitedMerge[n] = 1;
                            region.push(n);
                        }
                    }
                }
            }

            // Find Best Neighbor & Distance
            let bestNeighborIdx = -1;
            let minColorDiff = Infinity;

            for (let px of region) {
                const cx = px % width;
                const cy = Math.floor(px / width);
                const potentialNeighbors = [
                    (cx < width - 1) ? px + 1 : -1,
                    (cx > 0) ? px - 1 : -1,
                    (cy < height - 1) ? px + width : -1,
                    (cy > 0) ? px - width : -1
                ];

                for (let n of potentialNeighbors) {
                    if (n !== -1) {
                        const nIdx = indexMap[n];
                        if (nIdx !== -1 && nIdx !== rootIdx) {
                            const diff = ColorDist(centroids[rootIdx], centroids[nIdx]);
                            if (diff < minColorDiff) {
                                minColorDiff = diff;
                                bestNeighborIdx = nIdx;
                            }
                        }
                    }
                }
            }

            // Adaptive Threshold Logic
            let shouldMerge = false;
            if (bestNeighborIdx !== -1) {
                // If extremely small, always merge (unless protected face pixel)
                if (region.length < 2) {
                    shouldMerge = true;
                } else {
                    let sizeThreshold = mergeThresholdPixels;

                    // 1. Zonal Analysis
                    const regionStart = region[0];
                    const cx = regionStart % width;
                    const cy = Math.floor(regionStart / width);

                    // B. Subject Zone (Body)
                    // We removed the isFaceRegion check because we calculate it dynamically now
                    let isSubjectRegion = false;
                    if (preprocess.mask) {
                        // Check mask at region start
                        if (preprocess.mask[regionStart] === 1) {
                            isSubjectRegion = true;
                        }
                    }

                    // C. Center Zone
                    const imgCx = width / 2;
                    const imgCy = height / 2;
                    const centerDist = Math.sqrt((cx - imgCx) ** 2 + (cy - imgCy) ** 2);
                    const isCenterRegion = centerDist < (width * 0.4);

                    // 2. Threshold Assignment
                    // 2. Threshold Assignment - DYNAMIC MAPPING with GRADIENT FALLOFF
                    // Face Detail: 100 -> Thresh 4 (Tiny but paintable). 0 -> Thresh 30.
                    // Body Detail: 100 -> Thresh 15. 0 -> Thresh 60.
                    // BG Detail: 100 -> Thresh 40. 0 -> Thresh 200.

                    const faceD = preprocess.faceDetail ?? 50;
                    const bodyD = preprocess.bodyDetail ?? 50;
                    const bgD = preprocess.bgDetail ?? 50;

                    const mapThresh = (detail: number, low: number, high: number) => {
                        const t = detail / 100;
                        return Math.round(high - t * (high - low));
                    };

                    // Base Thresholds (Tuned for Paintability)
                    // Face: Never go below 5px (approx 1mm^2) to avoid "pepper noise"
                    const threshFace = mapThresh(faceD, 4, 30);
                    const threshBody = mapThresh(bodyD, 15, 60);

                    // HELPER: Elliptical Distance to nearest face
                    let minFaceDist = Infinity;
                    if (preprocess.faces) {
                        for (const f of preprocess.faces) {
                            const fcx = f.x + (f.width / 2);
                            const fcy = f.y + (f.height / 2);
                            const rx = (f.width / 2) * 1.0; // Full Face Width
                            const ry = (f.height / 2) * 1.0;

                            const safeRx = Math.max(1, rx);
                            const safeRy = Math.max(1, ry);
                            const dx = (cx - fcx) / safeRx;
                            const dy = (cy - fcy) / safeRy;
                            const d = Math.sqrt(dx * dx + dy * dy);

                            if (d < minFaceDist) minFaceDist = d;
                        }
                    }

                    // GRADIENT LOGIC
                    // 0.0 to 1.0 (Core): Full Face Detail
                    // 1.0 to 2.0 (Transition): Smooth Ramp from Face to Body
                    // > 2.0: Body/BG Detail

                    if (minFaceDist < 1.0) {
                        // ZONE A: CORE FACE
                        sizeThreshold = threshFace;
                    } else if (minFaceDist < 2.0) {
                        // ZONE B: TRANSITION (Feathered Edge)
                        // t goes from 0.0 (at dist 1.0) to 1.0 (at dist 2.0)
                        const t = (minFaceDist - 1.0) / 1.0;
                        // Smoothstep/Ease-in-out for organic fade
                        const smoothT = t * t * (3 - 2 * t);

                        // Interpolate: Face -> Body (or BG if not subject)
                        // If it's a subject pixel, fade to Body Thresh. If BG, fade to BG Thresh?
                        // Usually faces are attached to bodies, so fading to Body Thresh is safer.
                        const targetThresh = isSubjectRegion ? threshBody : mapThresh(bgD, 40, 200);

                        sizeThreshold = (1 - smoothT) * threshFace + smoothT * targetThresh;
                    } else if (isSubjectRegion) {
                        // ZONE C: BODY (Subject Mask)
                        sizeThreshold = threshBody;
                    } else {
                        // ZONE D & E: RADIAL BACKGROUND GRADIENT
                        // Smoothly transition from Center Detail to Edge Detail

                        const maxDist = Math.max(width, height) / 2;
                        const normDist = centerDist / maxDist; // 0.0 at center, ~1.0 at corner

                        // Define Transition Range
                        const innerR = 0.3; // Full Center Detail until 30% out
                        const outerR = 0.8; // Full Edge Detail after 80% out

                        const threshCenter = mapThresh(bgD, 20, 100);
                        const threshEdge = mergeThresholdPixels * mapThresh(bgD, 1.5, 4.0); // Slightly coarser edges

                        if (normDist <= innerR) {
                            sizeThreshold = threshCenter;
                        } else if (normDist >= outerR) {
                            sizeThreshold = threshEdge;
                        } else {
                            // Interpolate
                            const t = (normDist - innerR) / (outerR - innerR);
                            const smoothT = t * t * (3 - 2 * t);
                            sizeThreshold = (1 - smoothT) * threshCenter + smoothT * threshEdge;
                        }
                    }

                    // 3. Global Modifiers
                    // Skin tones are tricky, they form gradients.
                    if (minFaceDist >= 1.0 && isSkinTone(centroids[rootIdx])) {
                        // Allow a bit more merging on skin to prevent bands, but not if in Subject Zone
                        if (!isSubjectRegion) sizeThreshold *= 1.5;
                    }

                    // 4. TEXT GLOBAL OVERRIDE
                    // If we are inside a text box, we want to force preservation based on Detail Slider.
                    // TextDetail 100 => Threshold 1px (Preserve all).
                    // TextDetail 0/20 => Threshold ~15px (Normal).
                    const textD = preprocess.textDetail ?? 0;
                    if (textD > 0 && preprocess.text && preprocess.text.length > 0) {
                        // Check if current pixel is in any text box
                        // Optimization: Check center of region (cx, cy)
                        for (const box of preprocess.text) {
                            if (cx >= box.x && cx <= box.x + box.width &&
                                cy >= box.y && cy <= box.y + box.height) {

                                // Map Slider (20-100) to Threshold (10-1)
                                // 20 -> 10px
                                // 100 -> 1px
                                const t = Math.max(0, (textD - 20) / 80);
                                const textThresh = Math.round(10 - t * 9); // 10 down to 1

                                // FORCE LOWER THRESHOLD
                                sizeThreshold = Math.min(sizeThreshold, textThresh);
                                break;
                            }
                        }
                    }

                    if (region.length < sizeThreshold) {
                        shouldMerge = true;
                    }
                }
            }

            if (bestNeighborIdx !== -1 && shouldMerge) {
                for (let px of region) {
                    indexMap[px] = bestNeighborIdx;
                }
                changed = true;
            }
        }
        if (!changed) break;
    }

    // New Helper: Simple heuristic for skin-like tones (warm, mid-to-high luminance) - actually used only in Vectorization?
    // Wait, the original pipeline declared it here but used it in Vectorization. I won't move it unless needed here.
    // Ah, it's used in Vectorization (Pass 2). Refinement doesn't seem to use it.

    // Final Cleanup Pass: Eliminate Slim Slivers (The main cause of "Double Lines")
    for (let pass = 0; pass < 4; pass++) {
        let visitedClean = new Uint8Array(width * height);
        let changedClean = false;
        for (let i = 0; i < width * height; i++) {
            if (visitedClean[i] || indexMap[i] === -1) continue;
            const rootIdx = indexMap[i];
            const region = [i];
            visitedClean[i] = 1;

            let minX = width, maxX = 0, minY = height, maxY = 0;
            let head = 0;
            while (head < region.length) {
                const curr = region[head++];
                const cx = curr % width;
                const cy = Math.floor(curr / width);
                if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
                if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;

                const neighbors = [curr + 1, curr - 1, curr + width, curr - width];
                for (const n of neighbors) {
                    if (n >= 0 && n < width * height && Math.abs((n % width) - (curr % width)) < 2) {
                        if (visitedClean[n] === 0 && indexMap[n] === rootIdx) {
                            visitedClean[n] = 1;
                            region.push(n);
                        }
                    }
                }
            }

            const rW = (maxX - minX) + 1;
            const rH = (maxY - minY) + 1;
            const aspectRatio = Math.max(rW, rH) / Math.min(rW, rH);

            // Smart Sliver Removal - Tuned for Paintability
            const minDimension = Math.min(rW, rH);

            // 1. Unpaintable: Width < 10px (approx 2mm) - Was 8px
            // EXCEPTION: Keep "Blobs" (Aspect < 3) if > 5px (Pupils/Nostrils)
            let isUnpaintable = minDimension < 10;
            if (minDimension >= 5 && aspectRatio < 2.5) isUnpaintable = false;

            // 2. Double Lines (Slivers): Aspect Ratio > 8 (Was 12)
            // Stricter check against long thin "snakes"
            const isSliver = aspectRatio > 8;

            // 3. Tiny Rubbish
            let isTooSmall = region.length < mergeThresholdPixels;

            // PROTECT ZONES in Cleanup
            const startPx = region[0];
            const cx = startPx % width;
            const cy = Math.floor(startPx / width);

            // A. FACE Protection (Elliptical)
            if (preprocess.faces) {
                for (const f of preprocess.faces) {
                    const fcx = f.x + (f.width / 2);
                    const fcy = f.y + (f.height / 2);
                    // Standard radius
                    const rx = (f.width / 2);
                    const ry = (f.height / 2);

                    const dx = (cx - fcx) / Math.max(1, rx);
                    const dy = (cy - fcy) / Math.max(1, ry);
                    // Check if inside ellipse
                    if ((dx * dx + dy * dy) <= 1.0) {
                        // Allow tiny details in faces (eyes, pupils)
                        if (region.length > 2) isTooSmall = false;
                        isUnpaintable = false; // Always try to keep face details
                        break;
                    }
                }
            }

            // B. SUBJECT Protection (Fingers, Limbs)
            if (preprocess.mask && preprocess.mask[startPx] === 1) {
                // If it is part of the subject, we want to keep small details (fingers)
                // Fingers can be small (~50px area), and thin (~4px width)
                if (region.length > 10) isTooSmall = false;
                if (minDimension >= 3) isUnpaintable = false;
            }

            if (isTooSmall || isSliver || isUnpaintable) {
                let neighborCounts: Record<number, number> = {};
                let maxNCount = 0;
                let targetIdx = -1;

                for (const p of region) {
                    const neighbors = [p + 1, p - 1, p + width, p - width];
                    for (const n of neighbors) {
                        if (n >= 0 && n < width * height && indexMap[n] !== rootIdx && indexMap[n] !== -1) {
                            const nIdx = indexMap[n];
                            neighborCounts[nIdx] = (neighborCounts[nIdx] || 0) + 1;
                            if (neighborCounts[nIdx] > maxNCount) {
                                maxNCount = neighborCounts[nIdx];
                                targetIdx = nIdx;
                            }
                        }
                    }
                }

                if (targetIdx !== -1) {
                    for (const p of region) indexMap[p] = targetIdx;
                    changedClean = true;
                }
            }
        }
        if (!changedClean) break;
    }


    // Pass 1.8: Strict 'Paintable Core' Erosion Check
    for (let pass = 0; pass < 5; pass++) {
        let changedCore = false;

        // 1. Identify "Safe" Regions (Have a 5x5 block)
        const hasCore = new Set<number>();
        const coreRadius = 2; // Check radius 2 (5x5 block).

        for (let y = coreRadius; y < height - coreRadius; y++) {
            for (let x = coreRadius; x < width - coreRadius; x++) {
                const i = y * width + x;
                const idx = indexMap[i];
                if (idx === -1 || hasCore.has(idx)) continue;

                // Check 5x5 block around this pixel
                let isCore = true;
                blockCheck: for (let dy = -coreRadius; dy <= coreRadius; dy++) {
                    for (let dx = -coreRadius; dx <= coreRadius; dx++) {
                        const nIdx = indexMap[(y + dy) * width + (x + dx)];
                        if (nIdx !== idx) {
                            isCore = false;
                            break blockCheck;
                        }
                    }
                }

                if (isCore) {
                    hasCore.add(idx);
                }
            }
        }

        // 2. Merge "Unsafe" Regions
        const regionsToMerge = new Set<number>();

        // Scan full map to find active regions not in hasCore
        const activeRegions = new Set<number>();
        for (let i = 0; i < width * height; i++) {
            if (indexMap[i] !== -1) activeRegions.add(indexMap[i]);
        }

        for (const rIdx of activeRegions) {
            if (!hasCore.has(rIdx)) {
                regionsToMerge.add(rIdx);
            }
        }

        if (regionsToMerge.size === 0) break;

        // Perform Merge for confirmed Layouts
        const merges = new Map<number, number>(); // From -> To

        for (let i = 0; i < width * height; i++) {
            const idx = indexMap[i];
            if (regionsToMerge.has(idx)) {
                // Look for neighbor - prioritize SAFE neighbors
                const neighbors = [i + 1, i - 1, i + width, i - width];
                for (const n of neighbors) {
                    if (n >= 0 && n < width * height) {
                        const nIdx = indexMap[n];
                        if (nIdx !== -1 && nIdx !== idx && !regionsToMerge.has(nIdx)) {
                            merges.set(idx, nIdx);
                            break;
                        }
                    }
                }
                // Fallback: Merge into unsafe neighbor (clump them together)
                if (!merges.has(idx)) {
                    // PROTECT FACES from Forced Merge (Elliptical)
                    let inFace = false;
                    if (preprocess.faces) {
                        const cx = i % width;
                        const cy = Math.floor(i / width);
                        for (const f of preprocess.faces) {
                            const fcx = f.x + (f.width / 2);
                            const fcy = f.y + (f.height / 2);
                            const rx = f.width / 2;
                            const ry = f.height / 2;
                            const dx = (cx - fcx) / rx;
                            const dy = (cy - fcy) / ry;
                            if ((dx * dx + dy * dy) <= 1.0) {
                                inFace = true;
                                break;
                            }
                        }
                    }

                    if (!inFace) {
                        for (const n of neighbors) {
                            if (n >= 0 && n < width * height) {
                                const nIdx = indexMap[n];
                                if (nIdx !== -1 && nIdx !== idx) {
                                    merges.set(idx, nIdx);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }

        if (merges.size > 0) {
            for (let i = 0; i < width * height; i++) {
                if (merges.has(indexMap[i])) {
                    indexMap[i] = merges.get(indexMap[i])!;
                    changedCore = true;
                }
            }
        }

        if (!changedCore) break;
    }

    // Pass 2: Morphological Smoothing (Majority Filter)
    // "Predicts Smooth Lines" by removing single-pixel jaggedness
    const smoothBuffer = new Int32Array(width * height);
    for (let i = 0; i < width * height; i++) smoothBuffer[i] = indexMap[i];

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = y * width + x;
            const idx = indexMap[i];

            // Collect neighbors (3x3)
            const neighbors = [
                indexMap[i - width - 1], indexMap[i - width], indexMap[i - width + 1],
                indexMap[i - 1], idx, indexMap[i + 1],
                indexMap[i + width - 1], indexMap[i + width], indexMap[i + width + 1]
            ];

            // Find Mode
            const counts: Record<number, number> = {};
            let maxCount = 0;
            let mode = idx;
            for (const n of neighbors) {
                if (n === -1) continue;
                counts[n] = (counts[n] || 0) + 1;
                if (counts[n] > maxCount) {
                    maxCount = counts[n];
                    mode = n;
                }
            }

            // If dominant neighbor exists and is different, switch (Smooth)
            if (mode !== idx && maxCount >= 5) {
                smoothBuffer[i] = mode;
            }
        }
    }
    // Write back
    for (let i = 0; i < width * height; i++) indexMap[i] = smoothBuffer[i];
}
