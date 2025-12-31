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
                    maxDetected: 40, // Set to 40 per user request
                    minConfidence: 0.1, // Slightly higher to avoid false positives at high res
                    iouThreshold: 0.5, // Allow more overlap (50%) for crowded shots
                },
                mesh: { enabled: true },
                iris: { enabled: true },
                description: { enabled: false },
                emotion: { enabled: false },
                antispoof: { enabled: false },
                liveness: { enabled: false },
            },
            body: {
                enabled: true,
                modelPath: 'movenet-lightning.json' // Use lightweight MoveNet
            },
            segmentation: { enabled: false }, // Keep disabled to avoid RVM 404
            hand: { enabled: false },
            object: {
                enabled: true,
                modelPath: 'nanodet.json' // Use lightweight NanoDet
            },
            gesture: { enabled: false },
        };

        human = new HumanClass(humanConfig);
        await human.load();
    }

    const { data, width, height } = preprocess;

    // --- OPTIMIZATION: Downscale for Detection if huge ---
    const MAX_DETECTION_WIDTH = 2048; // Increased for Group Photos (Faces < 50px need this)
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

    // Extract Objects (NanoDet)
    const objects: any[] = [];
    if (result.object) {
        result.object.forEach(obj => {
            const [x, y, w, h] = obj.box;
            objects.push({
                x: x / scaleFactor,
                y: y / scaleFactor,
                width: w / scaleFactor,
                height: h / scaleFactor,
                score: obj.score,
                label: obj.label
            });
        });
    }

    // Extract Mask
    // ALWAYS initialize a mask to prevent pipeline crashes
    // Use 'any' to bypass strict ArrayBuffer vs SharedArrayBuffer conflicts in TS
    let mask: any = new Uint8Array(width * height); // Zero-filled (No mask)

    const anyResult = result as any;
    // 1. Priority: Semantic Segmentation (if enabled/available)
    if (anyResult.segmentation && anyResult.segmentation.data) {
        const rawMask = anyResult.segmentation.data;
        // Upscale Mask if needed
        if (Math.abs(scaleFactor - 1.0) > 0.01) {
            // Nearest Neighbor Upscale
            const sW = detectionWidth;
            for (let y = 0; y < height; y++) {
                const sy = Math.floor(y * scaleFactor);
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
            // No scaling
            if (rawMask.length === width * height) {
                for (let i = 0; i < rawMask.length; i++) {
                    const val = rawMask[i];
                    mask[i] = (val > 100 || (val > 0.4 && val <= 1.0)) ? 1 : 0;
                }
            }
        }
    }
    // 2. Fallback: Geometry Masking (Draw Soft Gradients)
    else {
        // Helper: Draw Soft Rectangle (Body/Object)
        // Peak value at center, fading out to edges.
        const addSoftBox = (box: { x: number, y: number, width: number, height: number }, peakVal: number) => {
            const startX = Math.max(0, Math.floor(box.x));
            const startY = Math.max(0, Math.floor(box.y));
            const endX = Math.min(width, Math.ceil(box.x + box.width));
            const endY = Math.min(height, Math.ceil(box.y + box.height));

            const cx = box.x + box.width / 2;
            const cy = box.y + box.height / 2;
            const rx = box.width / 2;
            const ry = box.height / 2;

            for (let y = startY; y < endY; y++) {
                for (let x = startX; x < endX; x++) {
                    // Normalized distance from center (0 to 1)
                    // We want a "rounded rectangle" feel, or just simple radial falloff from center?
                    // Simple radial is strictly oval. We want Box shape.
                    // Let's use max(dx, dy) for box falloff.
                    const dx = Math.abs(x - cx) / rx;
                    const dy = Math.abs(y - cy) / ry;

                    // Box distance: max(dx, dy).
                    // This creates a pyramid.
                    // Let's add smoothstep curve: 1 - smooth(d).
                    const d = Math.max(dx, dy);

                    if (d < 1.0) {
                        // Soft edge: fade starts at 0.5 (50% center is solid)
                        // If d < 0.5, val = peak.
                        // If d > 0.5, val fades to 0.
                        let factor = 1.0;
                        if (d > 0.6) {
                            factor = 1.0 - ((d - 0.6) / 0.4); // Linear fade at edge
                        }

                        const val = Math.floor(peakVal * factor);
                        const idx = y * width + x;
                        if (val > mask[idx]) mask[idx] = val;
                    }
                }
            }
        };

        // B. Bodies (Medium Detail) - 160
        bodies.forEach(body => {
            if (body.score < 0.2) return;
            addSoftBox(body, 160);
        });

        // C. Objects (Medium-Low Detail) - 120
        objects.forEach(obj => {
            if (obj.score < 0.3) return;
            addSoftBox(obj, 120);
        });

        // A. Faces (High Detail) - 255 (Highest Priority, draws over bodies)
        faces.forEach(face => {
            const cx = face.x + face.width / 2;
            const cy = face.y + face.height / 2;
            const rx = (face.width / 2);
            const ry = (face.height / 2);

            const startX = Math.max(0, Math.floor(face.x));
            const startY = Math.max(0, Math.floor(face.y));
            const endX = Math.min(width, Math.ceil(face.x + face.width));
            const endY = Math.min(height, Math.ceil(face.y + face.height));

            for (let y = startY; y < endY; y++) {
                for (let x = startX; x < endX; x++) {
                    // Ellipse Distance
                    const dx = (x - cx) / rx;
                    const dy = (y - cy) / ry;
                    const dSq = dx * dx + dy * dy;

                    if (dSq <= 1.0) {
                        // Gaussian-ish falloff
                        // Center = 255. Edge = ~50?
                        // Let's keep it high for the face, only fade at very edge.
                        const d = Math.sqrt(dSq);
                        let factor = 1.0;
                        if (d > 0.7) {
                            factor = 1.0 - ((d - 0.7) / 0.3);
                        }

                        const val = Math.floor(255 * factor);
                        const idx = y * width + x;
                        if (val > mask[idx]) mask[idx] = val;
                    }
                }
            }
        });
    }

    // Harden Mask is removed/unnecessary for Gradients, 
    // or we could use it as a "Blur" to smooth the jagged pixel logic.
    // But our math above is already smoothish.
    // Let's skip hardenMask.

    return {
        faces: faces,
        mask // Guaranteed to be Uint8Array (casted any)
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
