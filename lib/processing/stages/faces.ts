import { PreprocessResult } from "../types";
import * as tf from "@tensorflow/tfjs";
// Register WASM backend and get helper
import { setWasmPaths } from "@tensorflow/tfjs-backend-wasm";

// Import type only to avoid runtime top-level import
import type { Human, Config, FaceResult, BodyResult } from "@vladmandic/human";

// Global instance
let human: Human | null = null;

export interface FaceBox {
    x: number;
    y: number;
    width: number;
    height: number;
    score: number;
    landmarks?: {
        leftEye?: [number, number];
        rightEye?: [number, number];
        mouth?: [number, number];
        nose?: [number, number];
    };
}

export async function runFaceDetection(preprocess: PreprocessResult): Promise<{
    faces: FaceBox[],
    mask: Uint8Array | null
}> {
    if (!human) {
        // Dynamic import to ensure alias is registered first
        const HumanMod = await import("@vladmandic/human");
        const HumanClass = HumanMod.Human;

        // Set WASM paths for TFJS
        const path = await import("path");
        const wasmDir = path.join(process.cwd(), "node_modules/@tensorflow/tfjs-backend-wasm/dist/");
        setWasmPaths(wasmDir);

        const humanConfig: Partial<Config> = {
            backend: "cpu",
            modelBasePath: "https://vladmandic.github.io/human/models/",
            face: {
                enabled: true,
                detector: {
                    rotation: false,
                    maxDetected: 20, // Increase max faces
                    minConfidence: 0.05, // Extremely aggressive to catch all faces
                    iouThreshold: 0.3, // Less strict overlap
                },
                mesh: { enabled: true },
                iris: { enabled: true },
                description: { enabled: false },
                emotion: { enabled: false },
                antispoof: { enabled: false },
                liveness: { enabled: false },
            },
            body: { enabled: true },
            segmentation: { enabled: true }, // Enable Segmentation
            hand: { enabled: true }, // Enable Hand for "Woman holding bicycle"
            object: { enabled: false }, // Don't need generic objects, can be slow
            gesture: { enabled: false },
        };

        human = new HumanClass(humanConfig);
        await human.load();
    }

    const { data, width, height } = preprocess;

    // --- OPTIMIZATION: Downscale for Detection if huge ---
    const MAX_DETECTION_WIDTH = 1500;
    let detectionWidth = width;
    let detectionHeight = height;
    let detectionData = data;
    let scaleFactor = 1.0;

    if (width > MAX_DETECTION_WIDTH) {
        scaleFactor = MAX_DETECTION_WIDTH / width;
        detectionWidth = MAX_DETECTION_WIDTH;
        detectionHeight = Math.round(height * scaleFactor);

        console.log(`[Faces] Downscaling for performance: ${width}x${height} -> ${detectionWidth}x${detectionHeight} (Scale: ${scaleFactor.toFixed(2)})`);

        const sharp = (await import("sharp")).default;
        detectionData = await sharp(data, { raw: { width, height, channels: 4 } })
            .resize(detectionWidth, detectionHeight)
            .raw()
            .toBuffer();
    }

    // Convert Buffer to Tensor 
    const tensor = tf.tensor3d(new Uint8Array(detectionData), [detectionHeight, detectionWidth, 4], 'int32');

    // Detect
    const result = await human.detect(tensor);

    // Cleanup tensor
    tf.dispose(tensor);

    // Extract Boxes (Faces + Bodies)
    const faces = result.face.map((face: FaceResult) => {
        // Map back to original coordinate space
        const [x, y, w, h] = face.box;

        // Extract Landmarks from Mesh (Scaled)
        let landmarks: any = {};
        if (face.mesh && face.mesh.length > 470) {
            landmarks = {
                leftEye: [face.mesh[468][0] / scaleFactor, face.mesh[468][1] / scaleFactor],
                rightEye: [face.mesh[473][0] / scaleFactor, face.mesh[473][1] / scaleFactor],
                nose: [face.mesh[1][0] / scaleFactor, face.mesh[1][1] / scaleFactor],
                mouth: [face.mesh[13][0] / scaleFactor, face.mesh[13][1] / scaleFactor]
            };
        }

        return {
            x: x / scaleFactor,
            y: y / scaleFactor,
            width: w / scaleFactor,
            height: h / scaleFactor,
            score: face.boxScore || face.score,
            landmarks
        };
    });

    const bodies = result.body.map((body: BodyResult) => {
        const [x, y, w, h] = body.box;
        return {
            x: x / scaleFactor,
            y: y / scaleFactor,
            width: w / scaleFactor,
            height: h / scaleFactor,
            score: body.score,
        };
    });

    // Inject Hands as pseudo-bodies to ensure they are treated as Subjects
    if (result.hand && result.hand.length > 0) {
        result.hand.forEach(hand => {
            const [x, y, w, h] = hand.box;
            bodies.push({
                x: x / scaleFactor,
                y: y / scaleFactor,
                width: w / scaleFactor,
                height: h / scaleFactor,
                score: hand.score
            });
        });
    }

    // Extract Mask
    let mask: Uint8Array | null = null;
    const anyResult = result as any;
    if (anyResult.segmentation && anyResult.segmentation.data) {
        const rawMask = anyResult.segmentation.data;
        // Upscale Mask if needed
        if (Math.abs(scaleFactor - 1.0) > 0.01) {
            mask = new Uint8Array(width * height);

            // Nearest Neighbor Upscale
            // We iterate destination (full size) and sample source
            const sW = detectionWidth;
            // const sH = detectionHeight;

            for (let y = 0; y < height; y++) {
                const sy = Math.floor(y * scaleFactor);
                // Clamp
                if (sy >= detectionHeight) continue;

                const yOffset = y * width;
                const syOffset = sy * sW;

                for (let x = 0; x < width; x++) {
                    const sx = Math.floor(x * scaleFactor);
                    if (sx >= detectionWidth) continue;

                    const val = rawMask[syOffset + sx];
                    mask[yOffset + x] = (val > 100 || (val > 0.4 && val <= 1.0)) ? 1 : 0;
                }
            }
        } else {
            // No scaling, just threshold
            if (rawMask.length === width * height) {
                const tempMask = new Uint8Array(width * height);
                for (let i = 0; i < rawMask.length; i++) {
                    const val = rawMask[i];
                    tempMask[i] = (val > 100 || (val > 0.4 && val <= 1.0)) ? 1 : 0;
                }
                mask = tempMask;
            }
        }

        // Apply Manual Hand Masking (Scaled)
        if (mask && result.hand) {
            result.hand.forEach(hand => {
                if (hand.score > 0.3) {
                    // Scale Hand Box back to Original Space
                    const hx = hand.box[0] / scaleFactor;
                    const hy = hand.box[1] / scaleFactor;
                    const hw = hand.box[2] / scaleFactor;
                    const hh = hand.box[3] / scaleFactor;

                    const startX = Math.max(0, Math.floor(hx));
                    const startY = Math.max(0, Math.floor(hy));
                    const endX = Math.min(width, Math.ceil(hx + hw));
                    const endY = Math.min(height, Math.ceil(hy + hh));

                    for (let y = startY; y < endY; y++) {
                        for (let x = startX; x < endX; x++) {
                            mask![y * width + x] = 1;
                        }
                    }
                }
            });
        }

        if (mask) {
            mask = hardenMask(mask, width, height);
        }
    }

    // FALLBACK: HEAD ESTIMATION for Missing Faces (Profiles/Back of heads)
    // If a body exists but has no corresponding face detected, we infer the head position.
    bodies.forEach(body => {
        // Heuristic: Head is roughly the top 1/5th of the body box, centered horizontally.
        // Or if 'nose' keypoint exists (not extracting keypoints here for perf, using box heuristic).

        // Refined Heuristic:
        // Head Width ~ 1/3 to 1/2 of Body Width (Shoulders)
        // Head Height ~ 1/6 to 1/5 of Body Height

        const headW = body.width * 0.4;
        const headH = body.height * 0.18;
        const headX = body.x + (body.width - headW) / 2;
        const headY = body.y; // Top of body box

        // Check if this "Estimated Head" is covered by an existing Real Face
        let isCovered = false;
        for (const face of faces) {
            // Check Intersection
            const ix = Math.max(face.x, headX);
            const iy = Math.max(face.y, headY);
            const iw = Math.min(face.x + face.width, headX + headW) - ix;
            const ih = Math.min(face.y + face.height, headY + headH) - iy;

            if (iw > 0 && ih > 0) {
                // If overlap is significant (any overlap really, meaning we found A face there)
                isCovered = true;
                break;
            }
        }

        if (!isCovered) {
            // NO FACE FOUND for this body. Inject Synthetic Face.
            faces.push({
                x: headX,
                y: headY,
                width: headW,
                height: headH, // Extend down slightly?
                score: body.score * 0.8, // Slightly lower confidence than real body
                landmarks: {} // No landmarks for synthetic
            });
        }
    });

    return {
        faces: faces, // DO NOT merge bodies here. Bodies are handled by the mask.
        mask
    };
}

// Helper: Morphological Closing (Dilate -> Erode)
// Fills small gaps (radius 2 approx 5px) to connect limbs
function hardenMask(mask: Uint8Array, width: number, height: number): Uint8Array {
    const dilated = new Uint8Array(mask.length);
    const result = new Uint8Array(mask.length);
    const radius = 2; // Kernel radius (approx 5x5)

    // 1. Dilate
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (mask[idx] === 1) {
                // If pixel is set, set neighbors
                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const ny = y + dy;
                        const nx = x + dx;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            dilated[ny * width + nx] = 1;
                        }
                    }
                }
            }
        }
    }

    // 2. Erode
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            let keep = true;
            // If pixel is set, check if all neighbors are set (in dilated)
            // Actually, for Closing (fill holes), we dilate then erode.
            // Erosion: Set to 0 if any neighbor is 0.
            if (dilated[idx] === 1) {
                // Optimization: Only check boundary if needed.
                // Correct logic: output = 1 if ALL neighbors in dilated are 1.
                // Wait, standard erosion: min(neighbors).
                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const ny = y + dy;
                        const nx = x + dx;
                        // Boundary check
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            if (dilated[ny * width + nx] === 0) {
                                keep = false;
                                break;
                            }
                        } else {
                            // Border handling: assume 0?
                            keep = false;
                            break;
                        }
                    }
                    if (!keep) break;
                }
                result[idx] = keep ? 1 : 0;
            } else {
                result[idx] = 0;
            }
        }
    }

    return result;
}
