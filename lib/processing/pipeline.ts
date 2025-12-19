import sharp from "sharp";
import skmeans from "skmeans";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { paintcolors } from "../colors";
import nearestColor from "nearest-color";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// Setup nearest color
const colorMap = nearestColor.from(
    paintcolors.reduce((acc, curr) => ({ ...acc, [curr.name]: curr.hex }), {})
);

export async function processImage(
    imagePath: string,
    numColors: number,
    complexity: number = 5,
    customDim?: { width: number, height: number }
): Promise<{
    outputUrl: string;
    outlineUrl: string;
    palette: { color: string; name: string; amount: number; percentage: number }[];
    labels: { x: number; y: number; index: number; light?: boolean; fontSize?: number }[];
    dimensions: { width: number; height: number };
}> {
    // 1. Load image
    const pipeline = sharp(imagePath);
    const metadata = await pipeline.metadata();

    // 1a. Dynamic Resolution Scaling (Target 150 PPI)
    const targetPPI = 150;
    const targetInches = customDim?.width || 20;
    // Lowered cap to 3200px to prevent OOM on standard server memory
    const workingWidth = Math.min(3200, Math.max(1600, Math.round(targetInches * targetPPI)));

    // Pixel Threshold for Merging (approx 5mm^2 area)
    const pixelsPerMm = workingWidth / (targetInches * 25.4);
    // Adjusted minimum region size to 10mm² to preserve facial details
    const MIN_REGION_MM2 = 10;
    const mergeThresholdPixels = Math.round(MIN_REGION_MM2 * (pixelsPerMm ** 2));

    let processedPipe = pipeline
        .resize({ width: workingWidth, fit: 'inside' })
        .ensureAlpha();

    // Apply blur based on complexity (Reduced for sharpness)
    if (complexity < 10) {
        const sigma = Math.max(0.5, (10 - complexity) / 3);
        processedPipe = processedPipe.blur(sigma);
    }

    const { data, info } = await processedPipe
        .raw()
        .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;

    // 2. Extract pixels for clustering
    // Increased step to 40 for speed and lower memory footprint
    const pixels: number[][] = [];
    const step = 40; // Sample every ~40th pixel
    for (let i = 0; i < data.length; i += 4 * step) {
        if (data[i + 3] < 128) continue;
        pixels.push([data[i], data[i + 1], data[i + 2]]);
    }

    // 3. Run K-means
    const res = skmeans(pixels, numColors, undefined, 10);
    let rawCentroids = res.centroids as number[][];

    // Sort Centroids by Hue (Rainbow) to group similar adjacent numbers
    const rgbToHsl = (r: number, g: number, b: number) => {
        r /= 255, g /= 255, b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return [h, s, l];
    };

    // Create a mapping from old centroid index to new sorted index
    const sortedIndices = rawCentroids.map((c, i) => ({ c, i }))
        .sort((a, b) => {
            const hslA = rgbToHsl(a.c[0], a.c[1], a.c[2]);
            const hslB = rgbToHsl(b.c[0], b.c[1], b.c[2]);
            // Sort by Hue primary, then Luminance
            return (hslA[0] - hslB[0]) || (hslA[2] - hslB[2]);
        });

    const centroids = sortedIndices.map(x => x.c);
    const oldToNewIdx = new Array(rawCentroids.length);
    sortedIndices.forEach((x, newIdx) => { oldToNewIdx[x.i] = newIdx; });

    // 4. Map & Region Analysis
    const posterizedData = Buffer.alloc(data.length);
    const outlineData = Buffer.alloc(data.length); // Transparent with lines

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
    indexMap = smoothedIndexMap;

    // Pass 1.6: Contrast-Aware Region Merging
    const ColorDist = (c1: number[], c2: number[]) => Math.sqrt((c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2 + (c1[2] - c2[2]) ** 2);

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
                // If extremely small, always merge
                if (region.length < 50) {
                    shouldMerge = true;
                } else {
                    // Interpolate threshold based on contrast usage physical units
                    // mergeThresholdPixels is ~5mm^2
                    let sizeThreshold = mergeThresholdPixels;

                    if (minColorDiff > 60) sizeThreshold = mergeThresholdPixels * 0.2; // Keep ~1mm details if sharp
                    else if (minColorDiff > 30) sizeThreshold = mergeThresholdPixels * 0.8; // Standard
                    else sizeThreshold = mergeThresholdPixels * 2.5; // Smooth background noise

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
    // Helper: Simple heuristic for skin-like tones (warm, mid-to-high luminance)
    const isHumanTone = (rgb: number[]) => {
        const [r, g, b] = rgb;
        return r > 50 && g > 30 && b > 20 && r > g && g > b && (r - b) > 20;
    };

    // Final Cleanup Pass: Eliminate Slim Slivers (The main cause of "Double Lines")
    // We look for regions with a high Perimeter-to-Area ratio or narrow dimensions.
    // Boosted passes to 4 for thorough scrubbing.
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
            const density = region.length / (rW * rH);

            // Smart Sliver Removal - Tuned for Faces
            const minDimension = Math.min(rW, rH);

            // 1. Unpaintable: Width < 8px (approx 1.5mm)
            // EXCEPTION: Keep "Blobs" (Aspect < 3) if > 4px (Pupils/Nostrils)
            let isUnpaintable = minDimension < 8;
            if (minDimension >= 4 && aspectRatio < 3) isUnpaintable = false;

            // 2. Double Lines (Slivers): Aspect Ratio > 12 (Snake like)
            // These are almost always artifacts between colors.
            const isSliver = aspectRatio > 12;

            // 3. Tiny Rubbish
            const isTooSmall = region.length < mergeThresholdPixels;

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


    // Pass 1.8: Strict Paintability Sanity Check (The "Confirm Check")
    // Force-merge any remaining regions that are physically too small to print/paint.
    // This runs after the smart cleanup to catch any edge cases.
    for (let pass = 0; pass < 3; pass++) {
        let changedSanity = false;
        const currentRegions = new Map<number, number[]>();
        for (let i = 0; i < width * height; i++) {
            const idx = indexMap[i];
            if (idx === -1) continue;
            if (!currentRegions.has(idx)) currentRegions.set(idx, []);
            currentRegions.get(idx)!.push(i);
        }

        for (const [rootIdx, region] of currentRegions) {
            let minX = width, maxX = 0, minY = height, maxY = 0;
            for (const p of region) {
                const px = p % width, py = Math.floor(p / width);
                if (px < minX) minX = px;
                if (px > maxX) maxX = px;
                if (py < minY) minY = py;
                if (py > maxY) maxY = py;
            }
            const rW = (maxX - minX) + 1;
            const rH = (maxY - minY) + 1;
            const aspectRatio = Math.max(rW, rH) / Math.min(rW, rH);
            const minDim = Math.min(rW, rH);

            // STRICT Thresholds:
            // Must be > 15mm^2 AND > 5px wide to survive.
            const isTinyArea = region.length < (mergeThresholdPixels * 1.5);
            const isTooThin = minDim < 5;

            // Exception: Small "Blobs" (Eyes/Nostrils) are allowed if > 2px
            const isSafeBlob = aspectRatio < 3 && minDim > 2;

            if ((isTinyArea || isTooThin) && !isSafeBlob) {
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
                    changedSanity = true;
                }
            }
        }
        if (!changedSanity) break;
    }


    // Pass 2: Edge Detection & Outline Generation
    // Dotted lines are reserved ONLY for extremely subtle background gradients.
    const EDGE_BLEND_THRESHOLD = 35;

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

                // SOLID line enforcement: Humans or High Contrast
                const isHumanEdge = isHumanTone(c1) || isHumanTone(c2);
                const isHighContrast = dist > EDGE_BLEND_THRESHOLD;

                if (isHumanEdge || isHighContrast) {
                    // SOLID: Deep grey/black for clarity
                    outlineData[offset] = 45;
                    outlineData[offset + 1] = 45;
                    outlineData[offset + 2] = 45;
                    outlineData[offset + 3] = 255;
                } else {
                    // DOTTED: Subtle transitions
                    // Refined pattern: 6px on, 9px off for a clean look
                    if ((x + y) % 15 < 6) {
                        outlineData[offset] = 90;
                        outlineData[offset + 1] = 90;
                        outlineData[offset + 2] = 90;
                        outlineData[offset + 3] = 255;
                    } else {
                        outlineData[offset + 3] = 0;
                    }
                }
            } else {
                outlineData[offset + 3] = 0;
            }
        }
    }

    // Pass 3: Identify Regions (Connected Components) & Build Labels with Dynamic Sizing
    // We'll use a simplified Pole of Inaccessibility for label placement (Visual Center)
    // And add multiple labels for huge snake-like regions.

    const labels: { x: number, y: number, index: number, fontSize: number, light?: boolean }[] = [];
    const visited = new Uint8Array(width * height);
    const MIN_REGION_SIZE = 15; // Lowered to 15 to ensure even very small isolated details are numbered

    let maxRegion = { area: 0, cx: 0, cy: 0, width: 0, height: 0, minX: 0, minY: 0 };

    for (let i = 0; i < width * height; i++) {
        if (visited[i] === 1 || indexMap[i] === -1) continue;

        // Start BFS
        const idx = indexMap[i];
        let q = [i];
        visited[i] = 1;

        let minX = width, maxX = 0, minY = height, maxY = 0;
        const regionPixels = [];

        let head = 0;
        while (head < q.length) {
            const curr = q[head++];
            const cy = Math.floor(curr / width);
            const cx = curr % width;

            regionPixels.push({ x: cx, y: cy });

            if (cx < minX) minX = cx;
            if (cx > maxX) maxX = cx;
            if (cy < minY) minY = cy;
            if (cy > maxY) maxY = cy;

            const neighbors = [
                curr + 1, curr - 1, curr + width, curr - width
            ];

            for (const n of neighbors) {
                const ny = Math.floor(n / width);
                const nx = n % width;

                // Prevent row wrapping validation
                const dy = Math.abs(ny - cy);
                const dx = Math.abs(nx - cx);
                if ((dx + dy) === 1 && ny >= 0 && ny < height && nx >= 0 && nx < width) {
                    if (visited[n] === 0 && indexMap[n] === idx) {
                        visited[n] = 1;
                        q.push(n);
                    }
                }
            }
        }

        if (regionPixels.length > MIN_REGION_SIZE) {
            // 1. Identify Boundary Pixels for this region
            const boundary: { x: number, y: number }[] = [];
            for (const curr of q) {
                const cx = curr % width;
                const cy = Math.floor(curr / width);
                const neighbors = [curr + 1, curr - 1, curr + width, curr - width];
                let isBoundary = false;
                for (const n of neighbors) {
                    const nx = n % width;
                    const ny = Math.floor(n / width);
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height || indexMap[n] !== idx) {
                        isBoundary = true;
                        break;
                    }
                }
                if (isBoundary) boundary.push({ x: cx, y: cy });
            }

            // 2. Identify Label Points (Centroids or Multiple for large/complex regions)
            let candidatePoints: { x: number, y: number }[] = [];
            const rWidth = maxX - minX;
            const rHeight = maxY - minY;
            const area = regionPixels.length;
            const complexityFactor = (rWidth * rHeight) / area; // High factor = snakey/hollow region

            if (area > 1500 || complexityFactor > 4 || Math.max(rWidth, rHeight) > 100) {
                // More aggressive repetition for large or snaking regions
                let numClusters = 1;
                if (area > 50000) numClusters = 8;
                else if (area > 20000) numClusters = 6;
                else if (area > 8000) numClusters = 4;
                else if (area > 2500 || complexityFactor > 4) numClusters = 2;

                const subCentroids = skmeans(regionPixels.map(p => [p.x, p.y]), numClusters, undefined, 3).centroids;
                candidatePoints.push(...subCentroids.map((c: number[]) => ({ x: c[0], y: c[1] })));
            } else {
                // Use mean centroid
                let sumX = 0, sumY = 0;
                for (const p of regionPixels) { sumX += p.x; sumY += p.y; }
                candidatePoints.push({ x: sumX / area, y: sumY / area });
            }

            // 3. Refine candidates to the "Pole of Inaccessibility"
            for (const startPt of candidatePoints) {
                let bestPt = startPt;
                let maxDistSq = -1;

                const searchStep = regionPixels.length > 5000 ? 5 : 1;
                const boundaryStep = boundary.length > 1000 ? 5 : 1;

                for (let k = 0; k < regionPixels.length; k += searchStep) {
                    const p = regionPixels[k];
                    let minDistSq = Infinity;
                    for (let b = 0; b < boundary.length; b += boundaryStep) {
                        const dSq = (p.x - boundary[b].x) ** 2 + (p.y - boundary[b].y) ** 2;
                        if (dSq < minDistSq) {
                            minDistSq = dSq;
                            if (minDistSq < maxDistSq) break;
                        }
                    }
                    if (minDistSq > maxDistSq) {
                        maxDistSq = minDistSq;
                        bestPt = p;
                    }
                }

                const clearance = Math.sqrt(maxDistSq);

                // 4. Calibration for "4-5pt" target in PDF.
                // In generator.ts, fontSize = label.fontSize * 16.
                // 4pt = 0.25 * 16. 
                // We want a floor that ensures readability.
                const digitCount = (idx + 1) >= 10 ? 2 : 1;
                const boxW = digitCount * 8.5; // Estimated width per digit at base scale 1.0

                let fontScale = (clearance * 0.9) / boxW;
                // Minimum scale 0.25 (results in ~4pt) for tiny regions
                // Maximum scale 1.1 (results in ~17.6pt) for giant regions
                fontScale = Math.min(1.1, Math.max(0.25, fontScale));

                const rx = Math.round(bestPt.x);
                const ry = Math.round(bestPt.y);
                const pIdx = ry * width + rx;

                // Ensure point is still inside the region after refinement
                if (indexMap[pIdx] === idx) {
                    labels.push({
                        x: rx,
                        y: ry,
                        index: idx + 1,
                        fontSize: fontScale
                    });
                }
            }

            // Track largest region for logo placement
            if (area > maxRegion.area) {
                maxRegion = {
                    area,
                    cx: Math.round(maxX + minX) / 2, // simple bbox center for watermark is fine
                    cy: Math.round(maxY + minY) / 2,
                    width: rWidth,
                    height: rHeight,
                    minX,
                    minY
                };
            }
        }
    }

    // 5. Save outputs
    const resultId = randomUUID();
    const posterizedFilename = `processed-${resultId}.png`;
    const outlineFilename = `outline-${resultId}.png`;

    await sharp(posterizedData, { raw: { width, height, channels: 4 } })
        .png()
        .toFile(path.join(UPLOAD_DIR, posterizedFilename));

    // Prepare Outline with Logo Overlay
    let outlinePipe = sharp(outlineData, { raw: { width, height, channels: 4 } }).png();

    // Attempt to finding and compositing logo
    if (maxRegion.area > 0) {
        try {
            const logoPath = path.join(process.cwd(), "public", "brush4laughs_logo.png");
            // Check existence? sharp will throw if not found.

            // Calculate Logo Size - fit within 60% of region, max 25% of image width
            const targetW = Math.min(maxRegion.width * 0.6, maxRegion.height * 0.6, width * 0.25);

            if (targetW > 20) { // Only if reasonably sized
                // Load and preprocess logo: Make white transparent
                // Standard approach: 
                // 1. Grayscale
                // 2. Invert -> Use as Alpha channel?
                // Or just Replace Color if fuzzy.
                // Let's try a robust "Remove White Background" approach using modulation.

                const logoRaw = sharp(logoPath).resize({ width: Math.round(targetW) });
                const { data: logoData, info: logoInfo } = await logoRaw
                    .ensureAlpha()
                    .raw()
                    .toBuffer({ resolveWithObject: true });

                // Manual pixel loop to make white pixels transparent and darken the rest for the watermark
                for (let i = 0; i < logoData.length; i += 4) {
                    const r = logoData[i];
                    const g = logoData[i + 1];
                    const b = logoData[i + 2];

                    // Check if near white
                    if (r > 240 && g > 240 && b > 240) {
                        logoData[i + 3] = 0; // Transparent
                    } else {
                        // Make it faint grey for watermark
                        logoData[i] = 180;
                        logoData[i + 1] = 180;
                        logoData[i + 2] = 180;
                        logoData[i + 3] = 100; // Semi-transparent
                    }
                }

                const processedLogo = await sharp(logoData, {
                    raw: { width: logoInfo.width, height: logoInfo.height, channels: 4 }
                }).png().toBuffer();

                outlinePipe = outlinePipe.composite([{
                    input: processedLogo,
                    top: Math.round(maxRegion.cy - (logoInfo.height / 2)),
                    left: Math.round(maxRegion.cx - (logoInfo.width / 2)),
                    blend: 'over'
                }]);
            }
        } catch (e) {
            console.warn("Logo overlay failed", e);
        }
    }

    await outlinePipe.toFile(path.join(UPLOAD_DIR, outlineFilename));

    // 6. Build Rich Palette
    const palette = centroids.map((c, i) => {
        const hex = "#" + [c[0], c[1], c[2]].map(x => {
            const h = Math.round(x).toString(16);
            return h.length === 1 ? "0" + h : h;
        }).join("");

        const match = colorMap(hex);
        const percentage = (counts[i] / totalOpaquePixels);

        // Estimate: 45ml total for kit (generous for 16x20 masterpiece).
        const totalVolumeMl = 45;
        const rawAmount = percentage * totalVolumeMl;

        return {
            color: hex,
            name: match ? match.name : "Custom",
            percentage: percentage,
            amount: rawAmount, // Number (ml)
        };
    });

    return {
        outputUrl: `/uploads/${posterizedFilename}`,
        outlineUrl: `/uploads/${outlineFilename}`,
        palette,
        labels, // Return labels for client-side PDF generation
        dimensions: { width, height }
    };
}
