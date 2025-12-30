import skmeans from "skmeans";
import { PreprocessResult, QuantizeResult } from "../types";

export function runQuantize(
    preprocess: PreprocessResult,
    numColors: number
): QuantizeResult {
    const { data } = preprocess;
    const { faces, width, height } = preprocess;

    // Helper: Is pixel in Subject mask? (Face, Body, or Center)
    const isSubject = (idx: number) => {
        // 1. Faces/Bodies
        if (faces && faces.length > 0) {
            const x = (idx / 4) % width;
            const y = Math.floor((idx / 4) / width);
            for (const face of faces) {
                // Expand box slightly (10%) to catch hair/ears
                const padX = face.width * 0.1;
                const padY = face.height * 0.1;
                if (x >= face.x - padX && x <= face.x + face.width + padX &&
                    y >= face.y - padY && y <= face.y + face.height + padY) {
                    return true;
                }
            }
        }
        // 2. Center Region (Safe zone for main subject)
        const height = data.length / 4 / width;
        const x = (idx / 4) % width;
        const y = Math.floor((idx / 4) / width);
        const cx = width / 2;
        const cy = height / 2;
        // Priority Radius: 33% of min dimension
        const radius = Math.min(width, height) * 0.33;
        if ((x - cx) ** 2 + (y - cy) ** 2 < radius ** 2) {
            return true;
        }
        return false;
    };

    // 2. Factorized Pixel Collection
    // We strictly separate "Face Pixels" from "Body Pixels" so they don't pollute each other's statistics.
    const facePixels: number[][] = [];
    const bodyPixels: number[][] = []; // Formally 'subjectPixels' excluding face
    const bgPixels: number[][] = [];

    // Helper to check if index is inside ANY face oval (elliptical)
    const isInFaceOval = (x: number, y: number) => {
        if (!faces) return false;
        for (const f of faces) {
            const fcx = f.x + (f.width / 2);
            const fcy = f.y + (f.height / 2);
            const rx = f.width / 2;
            const ry = f.height / 2;

            // Normalize coordinate
            const dx = (x - fcx) / Math.max(1, rx);
            const dy = (y - fcy) / Math.max(1, ry);

            // Check Ellipse: x^2 + y^2 <= 1
            if ((dx * dx + dy * dy) <= 1.0) return true;
        }
        return false;
    };

    // Sampling Rates - DYNAMIC MAPPING
    // Detail (0-100) -> Step (High->Low)
    // Face: 0=Step4, 100=Step1. Default 50=Step2.
    const faceD = preprocess.faceDetail ?? 50;
    const bodyD = preprocess.bodyDetail ?? 50;
    const bgD = preprocess.bgDetail ?? 50;

    const mapStep = (detail: number, minStep: number, maxStep: number) => {
        // Invert: High Detail (100) = Min Step
        const t = detail / 100;
        return Math.max(1, Math.round(maxStep - t * (maxStep - minStep)));
    };


    const totalPixels = width * height;
    const TARGET_SAMPLES = 50000;

    // Auto-adjust steps based on resolution to prevent OOM/Slowdown
    // If we have 12MP image, minStep should be ~240 to get 50k samples.
    // We want relatively consistent sampling density regardless of image size.
    const resolutionScalar = Math.max(1, Math.floor(totalPixels / TARGET_SAMPLES));

    console.log(`[Quantize] Resolution Scalar: ${resolutionScalar} (Total Pixels: ${totalPixels})`);

    const STEP_DETAIL = Math.max(mapStep(faceD, 1, 4), Math.floor(resolutionScalar * 0.2)); // Face needs high detail, so smaller step
    const STEP_BODY = Math.max(mapStep(bodyD, 2, 8), Math.floor(resolutionScalar * 0.5));
    const STEP_BG = Math.max(mapStep(bgD, 15, 60), Math.floor(resolutionScalar * 1.5)); // BG can be sparse

    console.log(`[Quantize] Sampling Steps (Dynamic): Face=${STEP_DETAIL}, Body=${STEP_BODY}, BG=${STEP_BG}`);

    // --- DYNAMIC SAMPLING LOOP ---
    // Instead of hard categories, we use the Gradient Mask from faces.ts to determine step size.
    // Mask Value (0-255) -> Detail Level (25-100) -> Step Size.

    // 1. Define Base Detail (User Request: 25% for Background)
    const MIN_DETAIL = 25;

    // We pre-calculate step sizes for optimization
    const getStepForMaskVal = (val: number) => {
        // Map 0-255 to MIN_DETAIL-100
        const detail = MIN_DETAIL + (val / 255.0) * (100 - MIN_DETAIL);

        // Map Detail to Step logic (Inverse of mapStep)
        // mapStep logic: (detail, minStep, maxStep)
        // We use a global range: High Detail=Step 1, Low Detail=Step 60
        // But we want it scaled by resolution.

        // Base Ranges based on resolution
        const MAX_STEP = Math.floor(resolutionScalar * 1.5); // Low detail step
        const MIN_STEP = 1; // High detail step (Face)

        const t = detail / 100; // 0.25 to 1.0

        // Interpolate
        return Math.max(1, Math.round(MAX_STEP - t * (MAX_STEP - MIN_STEP)));
    };

    // Pre-compute lookup table for 0-255 to save Math.round calls
    const stepLookup = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
        stepLookup[i] = getStepForMaskVal(i);
    }

    // Stats
    console.log(`[Quantize] Dynamic Steps: 0(BG)=${stepLookup[0]}, 160(Body)=${stepLookup[160]}, 255(Face)=${stepLookup[255]}`);

    const mask = preprocess.mask; // Gradient Mask

    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue; // Skip transparent

        const pixelIdx = i / 4;

        // Determine Step Size for this pixel
        let step = stepLookup[0]; // Default BG
        if (mask && mask[pixelIdx]) {
            step = stepLookup[mask[pixelIdx]];
        }

        // TEXT OVERRIDE: Text is always ultra-high detail
        let isText = false;
        const x = pixelIdx % width;
        const y = Math.floor(pixelIdx / width);
        if (preprocess.text) {
            for (const b of preprocess.text) {
                if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
                    isText = true;
                    break;
                }
            }
        }
        if (isText) step = 1;

        // Sampling Decision
        // To avoid grid artifacts from variable steps, we can use a randomized offset or just modulo.
        // Modulo is fine if density is high enough.

        if (pixelIdx % step === 0) {
            // Classify into buckets for k-means initialization
            // Roughly: 
            // Mask > 200 -> Face List
            // Mask > 50 -> Body List
            // Else -> BG List

            const rgb = [data[i], data[i + 1], data[i + 2]];

            if (isText || (mask && mask[pixelIdx] > 200)) {
                facePixels.push(rgb);
            } else if (mask && mask[pixelIdx] > 50) {
                bodyPixels.push(rgb);
            } else {
                bgPixels.push(rgb);
            }
        }
    }

    // 2. Find Anchors (Global Extremes in bodyPixels + facePixels)
    let minLum = 255;
    let maxLum = 0;
    let darkestPixel: number[] | null = null;
    let lightestPixel: number[] | null = null;

    // Scan Face Pixels for extremes (Prioritize face extremes)
    for (const p of [...facePixels, ...bodyPixels]) {
        const lum = 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
        if (lum < minLum) { minLum = lum; darkestPixel = p; }
        if (lum > maxLum) { maxLum = lum; lightestPixel = p; }
    }

    const anchors: number[][] = [];

    // 2.2 Geometric Feature Injection (Super Anchors) - Kept as is
    if (faces && faces.length > 0) {
        const getRegionColor = (lx: number, ly: number, type: 'darkest' | 'saturated' | 'lightest') => {
            let bestPixel: number[] | null = null;
            let bestScore = type === 'darkest' ? 255 : (type === 'lightest' ? 0 : -1);

            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const px = Math.floor(lx) + dx;
                    const py = Math.floor(ly) + dy;
                    if (px < 0 || px >= width || py < 0 || py >= data.length / 4 / width) continue;

                    const idx = (py * width + px) * 4;
                    const r = data[idx];
                    const g = data[idx + 1];
                    const b = data[idx + 2];

                    if (type === 'darkest' || type === 'lightest') {
                        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                        if (type === 'darkest' && lum < bestScore) { bestScore = lum; bestPixel = [r, g, b]; }
                        if (type === 'lightest' && lum > bestScore) { bestScore = lum; bestPixel = [r, g, b]; }
                    } else if (type === 'saturated') {
                        const max = Math.max(r, g, b);
                        const min = Math.min(r, g, b);
                        const sat = max - min;
                        if (sat > bestScore) { bestScore = sat; bestPixel = [r, g, b]; }
                    }
                }
            }
            return bestPixel;
        };

        for (const f of faces) {
            if (!f.landmarks) continue;
            if (f.landmarks.leftEye) {
                const c = getRegionColor(f.landmarks.leftEye[0], f.landmarks.leftEye[1], 'darkest');
                if (c && (c[0] + c[1] + c[2]) / 3 < 60) anchors.push(c);
            }
            if (f.landmarks.rightEye) {
                const c = getRegionColor(f.landmarks.rightEye[0], f.landmarks.rightEye[1], 'darkest');
                if (c && (c[0] + c[1] + c[2]) / 3 < 60) anchors.push(c);
            }
            if (f.landmarks.mouth) {
                const c = getRegionColor(f.landmarks.mouth[0], f.landmarks.mouth[1], 'darkest'); // Lip line
                if (c) anchors.push(c);
                // Also try saturated for lip color
                const c2 = getRegionColor(f.landmarks.mouth[0], f.landmarks.mouth[1], 'saturated');
                if (c2) anchors.push(c2);
            }
        }
    }

    if (darkestPixel && minLum < 40) anchors.push(darkestPixel);
    if (lightestPixel && maxLum > 215) anchors.push(lightestPixel);

    // 3. Dynamic Budget Allocation
    // Total Colors available to distribute
    // We treat 'anchors' as extra or part of budget? Part of budget.
    const reserved = anchors.length;
    const distributable = Math.max(2, numColors - reserved);

    let faceBudget = 0;
    let bodyBudget = 0;
    let bgBudget = 0;

    if (facePixels.length > 0) {
        // We have faces.
        // In Dual Pass, BG pixels might be 0.
        const hasBg = bgPixels.length > 0;

        if (!hasBg) {
            // SUBJECT ONLY LAYER
            // Split distributable between Face and Body
            // Face gets 40%, Min 4, Max 8.
            faceBudget = Math.max(4, Math.floor(distributable * 0.45));
            bodyBudget = Math.max(2, distributable - faceBudget);
        } else {
            // FULL IMAGE (Single Pass Fallback)
            // Face=30%, Body=30%, BG=40%
            faceBudget = Math.max(4, Math.floor(distributable * 0.3));
            bodyBudget = Math.max(4, Math.floor(distributable * 0.3));
            bgBudget = Math.max(2, distributable - faceBudget - bodyBudget);
        }
    } else {
        // No faces
        if (bgPixels.length === 0) {
            // Subject only, no face
            bodyBudget = distributable;
        } else {
            // Standard
            bodyBudget = Math.floor(distributable * 0.6);
            bgBudget = distributable - bodyBudget;
        }
    }

    // 4. Run K-Means independently
    let faceCentroids: number[][] = [];
    if (faceBudget > 0 && facePixels.length > 0) {
        // Use a higher maxIterations for face to get best fit
        const k = Math.min(facePixels.length, faceBudget);
        const res = skmeans(facePixels, k, undefined, 20);
        faceCentroids = res.centroids;
    }

    let subjectCentroids: number[][] = [];
    if (bodyBudget > 0 && bodyPixels.length > 0) {
        const k = Math.min(bodyPixels.length, bodyBudget);
        const res = skmeans(bodyPixels, k, undefined, 15);
        subjectCentroids = res.centroids;
    }

    let bgCentroids: number[][] = [];
    if (bgBudget > 0 && bgPixels.length > 0) {
        const k = Math.min(bgPixels.length, bgBudget);
        const res = skmeans(bgPixels, k, undefined, 10);
        bgCentroids = res.centroids;
    }

    // 5. Combine: Anchors + Face + Subject + Background
    let allCentroids = [...anchors, ...faceCentroids, ...subjectCentroids, ...bgCentroids];

    // PROTECT: Anchors + FaceVIPs are the first N elements
    const protectedCount = anchors.length + faceCentroids.length;

    // TIGHTER Merge Distance (was 10, now 5) to preserve variety
    const CLEAN_DIST = 5;
    let finalCentroids: number[][] = [];

    for (let i = 0; i < allCentroids.length; i++) {
        const c = allCentroids[i];
        let merged = false;

        for (const existing of finalCentroids) {
            const d = Math.sqrt((c[0] - existing[0]) ** 2 + (c[1] - existing[1]) ** 2 + (c[2] - existing[2]) ** 2);
            if (d < CLEAN_DIST) {
                merged = true;
                break;
            }
        }
        if (!merged) finalCentroids.push(c);
    }

    // 6. TRIM to exact target (if we have too many)
    // We iteratively merge the closest pair until we hit target.
    while (finalCentroids.length > numColors) {
        let minPairDist = Infinity;
        let p1 = -1;
        let p2 = -1;

        for (let i = 0; i < finalCentroids.length; i++) {
            for (let j = i + 1; j < finalCentroids.length; j++) {
                // PROTECTION LOGIC:
                const jIsProtected = j < protectedCount;
                const iIsProtected = i < protectedCount;

                if (iIsProtected && jIsProtected) continue;

                const d = Math.sqrt((finalCentroids[i][0] - finalCentroids[j][0]) ** 2 + (finalCentroids[i][1] - finalCentroids[j][1]) ** 2 + (finalCentroids[i][2] - finalCentroids[j][2]) ** 2);
                if (d < minPairDist) {
                    minPairDist = d;
                    p1 = i;
                    p2 = j;
                }
            }
        }

        if (p1 === -1) break;

        const p2IsProtected = p2 < protectedCount;
        if (p2IsProtected) {
            finalCentroids.splice(p1, 1);
        } else {
            finalCentroids.splice(p2, 1);
        }
    }

    // Safety: If we merged too many, we might have fewer than numColors. That's fine, clarity is better.

    // 7. Sort for Rainbow palette
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

    const sortedIndices = finalCentroids.map((c, i) => ({ c, i }))
        .sort((a, b) => {
            const hslA = rgbToHsl(a.c[0], a.c[1], a.c[2]);
            const hslB = rgbToHsl(b.c[0], b.c[1], b.c[2]);
            return (hslA[0] - hslB[0]) || (hslA[2] - hslB[2]);
        });

    const centroids = sortedIndices.map(x => x.c);

    // We lost the exact 1:1 mapping from the raw k-means results because we did a custom merge.
    // The rest of the pipeline (vectorization) just needs `centroids`.
    return {
        centroids,
        rawCentroids: centroids, // It's a new set
        oldToNewIdx: centroids.map((_, i) => i)
    };
}
