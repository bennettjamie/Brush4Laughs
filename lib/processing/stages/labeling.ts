import skmeans from "skmeans";
import { SegmentationResult } from "../types";

export interface LabelingResult {
    labels: { x: number; y: number; index: number; fontSize: number; light?: boolean }[];
    maxRegion: { area: number; cx: number; cy: number; width: number; height: number; minX: number; minY: number };
}

export function runLabeling(
    segmentation: SegmentationResult,
    width: number,
    height: number
): LabelingResult {
    const { indexMap } = segmentation;
    const labels: LabelingResult["labels"] = [];

    // Track largest region for logo placement
    let maxRegion = { area: 0, cx: 0, cy: 0, width: 0, height: 0, minX: 0, minY: 0 };

    // ---------------------------------------------------------
    // OPTIMIZATION: Global Distance Transform for Label Placement
    // Replaces O(Region * Boundary) brute force with O(Image)
    // ---------------------------------------------------------

    // 1. Initialize Distance Map
    const distMap = new Float32Array(width * height).fill(Infinity);
    const regionStats = new Map<number, {
        area: number,
        minX: number, maxX: number, minY: number, maxY: number,
        pixels: number[]
    }>();

    // Init Edge Pixels
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            const idx = indexMap[i];
            if (idx === -1) {
                distMap[i] = 0;
                continue;
            }

            // Init Regions Map
            if (!regionStats.has(idx)) {
                regionStats.set(idx, {
                    area: 0, minX: width, maxX: 0, minY: height, maxY: 0,
                    pixels: []
                });
            }
            const stats = regionStats.get(idx)!;
            stats.pixels.push(i);
            stats.area++;
            if (x < stats.minX) stats.minX = x;
            if (x > stats.maxX) stats.maxX = x;
            if (y < stats.minY) stats.minY = y;
            if (y > stats.maxY) stats.maxY = y;

            // Check if Edge
            let isEdge = false;
            // Immediate neighbors check
            if (x === 0 || x === width - 1 || y === 0 || y === height - 1) isEdge = true;
            else {
                if (indexMap[i - 1] !== idx || indexMap[i + 1] !== idx ||
                    indexMap[i - width] !== idx || indexMap[i + width] !== idx) {
                    isEdge = true;
                }
            }

            if (isEdge) {
                distMap[i] = 1; // Distance to boundary is small
            }
        }
    }

    // 2. Chamfer Distance Transform (Two Pass)

    // Pass 1: Top-Left to Bottom-Right
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            if (distMap[i] === 1) continue; // Already edge

            let minVal = distMap[i];
            if (x > 0) minVal = Math.min(minVal, distMap[i - 1] + 1);
            if (y > 0) minVal = Math.min(minVal, distMap[i - width] + 1);
            if (y > 0 && x > 0) minVal = Math.min(minVal, distMap[i - width - 1] + 1.4);
            if (y > 0 && x < width - 1) minVal = Math.min(minVal, distMap[i - width + 1] + 1.4);

            distMap[i] = minVal;
        }
    }

    // Pass 2: Bottom-Right to Top-Left
    for (let y = height - 1; y >= 0; y--) {
        for (let x = width - 1; x >= 0; x--) {
            const i = y * width + x;

            let minVal = distMap[i];
            if (x < width - 1) minVal = Math.min(minVal, distMap[i + 1] + 1);
            if (y < height - 1) minVal = Math.min(minVal, distMap[i + width] + 1);
            if (y < height - 1 && x < width - 1) minVal = Math.min(minVal, distMap[i + width + 1] + 1.4);
            if (y < height - 1 && x > 0) minVal = Math.min(minVal, distMap[i + width - 1] + 1.4);

            distMap[i] = minVal;
        }
    }

    // 3. Find Max for each region
    for (const [idx, stats] of regionStats.entries()) {
        const { pixels, minX, maxX, minY, maxY, area } = stats;

        // Update Max Region for Logo logic
        const rW = maxX - minX;
        const rHeight = maxY - minY;
        if (area > maxRegion.area) {
            maxRegion = {
                area,
                cx: (minX + maxX) / 2,
                cy: (minY + maxY) / 2,
                width: rW,
                height: rHeight,
                minX, minY
            };
        }

        // --- Label Placement Logic ---

        // 3a. Simple Region (Standard)
        let maxDist = -1;
        let bestP = -1;

        // 3b. Complex Region Check
        const complexityFactor = (rW * rHeight) / area;
        const isComplex = (area > 500 && complexityFactor > 2.5) || (area > 3000);

        if (!isComplex) {
            // Fast Path: Scan all pixels in region for max dist
            for (const p of pixels) {
                if (distMap[p] > maxDist) {
                    maxDist = distMap[p];
                    bestP = p;
                }
            }
            if (bestP !== -1) {
                pushLabel(idx, bestP, maxDist);
            } else {
                // Fallback 1: Centroid
                let sumX = 0, sumY = 0;
                for (const p of pixels) { sumX += (p % width); sumY += Math.floor(p / width); }
                const cx = Math.floor(sumX / pixels.length);
                const cy = Math.floor(sumY / pixels.length);
                const p = cy * width + cx;
                if (pixels.includes(p)) {
                    pushLabel(idx, p, 1);
                } else {
                    // Fallback 2: Just pick the first pixel
                    if (pixels.length > 5) {
                        pushLabel(idx, pixels[Math.floor(pixels.length / 2)], 1);
                    }
                }
            }
        } else {
            // 3c. Complex Region (Snake/Large): Use K-Means
            let numClusters = 2;
            if (area > 50000) numClusters = 12;
            else if (area > 20000) numClusters = 8;
            else if (area > 8000) numClusters = 5;
            else if (area > 2000) numClusters = 3;
            else numClusters = 2;

            const points = pixels.map(p => [(p % width), Math.floor(p / width)]);
            const res = skmeans(points, numClusters, undefined, 3); // Light k-means

            const clusterMaxDiff = new Array(numClusters).fill(-1);
            const clusterBestP = new Array(numClusters).fill(-1);

            res.idxs.forEach((clusterId: number, i: number) => {
                const p = pixels[i];
                const d = distMap[p];
                if (d > clusterMaxDiff[clusterId]) {
                    clusterMaxDiff[clusterId] = d;
                    clusterBestP[clusterId] = p;
                }
            });

            // Add labels for each valid cluster
            for (let c = 0; c < numClusters; c++) {
                if (clusterBestP[c] !== -1) {
                    pushLabel(idx, clusterBestP[c], clusterMaxDiff[c]);
                }
            }
        }
    }

    function pushLabel(idx: number, p: number, clearance: number) {
        const digitCount = (idx + 1) >= 10 ? 2 : 1;
        const boxW = digitCount * 8.5; // Base width factor

        let fontScale = (clearance * 0.9) / boxW;
        // Allow smaller fonts for tiny regions: 0.15 (~3pt) to 0.7 (~10pt)
        // 1.0 was ~14pt. So 0.7 is approx 10pt.
        fontScale = Math.min(0.7, Math.max(0.15, fontScale));

        labels.push({
            x: p % width,
            y: Math.floor(p / width),
            index: idx + 1,
            fontSize: fontScale
        });
    }

    return { labels, maxRegion };
}
