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

    // Convert Buffer to Tensor 
    const tensor = tf.tensor3d(new Uint8Array(data), [height, width, 4], 'int32');

    // Detect
    const result = await human.detect(tensor);

    // Cleanup tensor
    tf.dispose(tensor);

    // Extract Boxes (Faces + Bodies)
    const faces = result.face.map((face: FaceResult) => {
        const [x, y, w, h] = face.box;

        // Extract Landmarks from Mesh
        let landmarks: any = {};
        if (face.mesh && face.mesh.length > 470) {
            landmarks = {
                leftEye: [face.mesh[468][0], face.mesh[468][1]],
                rightEye: [face.mesh[473][0], face.mesh[473][1]],
                nose: [face.mesh[1][0], face.mesh[1][1]],
                mouth: [face.mesh[13][0], face.mesh[13][1]]
            };
        }

        return {
            x,
            y,
            width: w,
            height: h,
            score: face.boxScore || face.score,
            landmarks
        };
    });

    const bodies = result.body.map((body: BodyResult) => {
        const [x, y, w, h] = body.box;
        return {
            x,
            y,
            width: w,
            height: h,
            score: body.score,
        };
    });

    // Inject Hands as pseudo-bodies to ensure they are treated as Subjects
    if (result.hand && result.hand.length > 0) {
        result.hand.forEach(hand => {
            const [x, y, w, h] = hand.box;
            bodies.push({
                x, y, width: w, height: h, score: hand.score
            });
        });
    }

    // Extract Mask
    let mask: Uint8Array | null = null;
    const anyResult = result as any;
    if (anyResult.segmentation && anyResult.segmentation.data) {
        // Handle both 0-255 and 0-1 ranges
        const rawMask = anyResult.segmentation.data;
        if (rawMask.length === width * height) {
            const tempMask = new Uint8Array(width * height);
            for (let i = 0; i < rawMask.length; i++) {
                const val = rawMask[i];
                // Threshold logic:
                tempMask[i] = (val > 100 || (val > 0.4 && val <= 1.0)) ? 1 : 0;
            }

            // MANUAL MASK INJECTION FOR HANDS
            // Human segmentation sometimes misses extremities.
            // We force the box area (loosely) into the mask if high confidence?
            // Actually, just relying on `bodies` array for quantization is good, 
            // but for Refinement, we check `mask`.
            // Let's paint the hand boxes into the mask.
            if (result.hand) {
                result.hand.forEach(hand => {
                    if (hand.score > 0.3) {
                        const startX = Math.max(0, Math.floor(hand.box[0]));
                        const startY = Math.max(0, Math.floor(hand.box[1]));
                        const endX = Math.min(width, Math.ceil(hand.box[0] + hand.box[2]));
                        const endY = Math.min(height, Math.ceil(hand.box[1] + hand.box[3]));

                        for (let y = startY; y < endY; y++) {
                            for (let x = startX; x < endX; x++) {
                                tempMask[y * width + x] = 1;
                            }
                        }
                    }
                });
            }

            mask = hardenMask(tempMask, width, height);
        }
    }

    return {
        faces: [...faces, ...bodies],
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
