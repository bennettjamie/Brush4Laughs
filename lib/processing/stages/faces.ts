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
    const MAX_DETECTION_WIDTH = 1024; // Reduced from 1500 for VPS CPU safety
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
    let mask = new Uint8Array(width * height); // Zero-filled (No mask)

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
    // 2. Fallback: Geometry Masking (Draw Boxes/Ellipses)
    else {
        // A. Faces (Ellipses for smoother edges)
        faces.forEach(face => {
            const cx = face.x + face.width / 2;
            const cy = face.y + face.height / 2;
            const rx = (face.width / 2) * 0.9; // Slight shrink
            const ry = (face.height / 2) * 1.1; // Slight vertical stretch for head shape

            const startX = Math.max(0, Math.floor(face.x));
            const startY = Math.max(0, Math.floor(face.y));
            const endX = Math.min(width, Math.ceil(face.x + face.width));
            const endY = Math.min(height, Math.ceil(face.y + face.height));

            for (let y = startY; y < endY; y++) {
                for (let x = startX; x < endX; x++) {
                    // Normalize to ellipse equation: (x-h)^2/rx^2 + (y-k)^2/ry^2 <= 1
                    const dx = x - cx;
                    const dy = y - cy;
                    if (((dx * dx) / (rx * rx)) + ((dy * dy) / (ry * ry)) <= 1.0) {
                        mask[y * width + x] = 1;
                    }
                }
            }
        });

        // B. Bodies (Rectangles, maybe eroded later)
        bodies.forEach(body => {
            if (body.score < 0.2) return;
            const startX = Math.max(0, Math.floor(body.x));
            const startY = Math.max(0, Math.floor(body.y));
            const endX = Math.min(width, Math.ceil(body.x + body.width));
            const endY = Math.min(height, Math.ceil(body.y + body.height * 0.9)); // Cut off feet?

            for (let y = startY; y < endY; y++) {
                // Fill row (faster)
                const offset = y * width;
                mask.fill(1, offset + startX, offset + endX);
            }
        });

        // C. Objects (Rectangles)
        objects.forEach(obj => {
            if (obj.score < 0.3) return;
            // Filter labels? (e.g. 'tie', 'book' might not need detail?)
            // For now, include everything detected as "Subject"
            const startX = Math.max(0, Math.floor(obj.x));
            const startY = Math.max(0, Math.floor(obj.y));
            const endX = Math.min(width, Math.ceil(obj.x + obj.width));
            const endY = Math.min(height, Math.ceil(obj.y + obj.height));

            for (let y = startY; y < endY; y++) {
                const offset = y * width;
                mask.fill(1, offset + startX, offset + endX);
            }
        });
    }

    // Harden Mask (fill gaps)
    if (mask) {
        mask = hardenMask(mask as any, width, height);
    }

    return {
        faces: faces,
        mask // Guaranteed to be Uint8Array
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
