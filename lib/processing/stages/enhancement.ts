import sharp from "sharp";
import { FaceBox } from "./faces";

export async function enhanceFaces(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    faces: FaceBox[]
): Promise<void> {
    if (!faces || faces.length === 0) return;

    // We use Sharp for high-quality resizing and image manipulation
    // Construct main image from buffer
    const mainImage = sharp(data as any, { raw: { width, height, channels: 4 } });

    // Process each face
    const composites: { input: Buffer; top: number; left: number }[] = [];

    for (const face of faces) {
        const x = Math.floor(face.x);
        const y = Math.floor(face.y);
        const w = Math.floor(face.width);
        const h = Math.floor(face.height);

        // Skip invalid
        if (w <= 0 || h <= 0 || x + w > width || y + h > height) continue;

        // 1. Analyze Contrast (ROI Loop) & Inject Landmarks
        let minLum = 255;
        let maxLum = 0;

        // Access raw data for stats
        for (let row = y; row < y + h; row++) {
            for (let col = x; col < x + w; col++) {
                const idx = (row * width + col) * 4;
                const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                if (lum < minLum) minLum = lum;
                if (lum > maxLum) maxLum = lum;
            }
        }

        const contrastRange = maxLum - minLum;

        // 2. LANDMARK INJECTION (Paint Features)
        // If we have landmarks, we physically darken the eyes/mouth in the buffer
        // This guarantees the upscaler and color engine see distinctive dark spots.
        if (face.landmarks) {
            const pointsToCheck = [
                face.landmarks.leftEye,
                face.landmarks.rightEye,
                face.landmarks.mouth
            ];

            // Darken radius (scale with face size)
            const radius = Math.max(1, Math.round(w / 60));

            for (const pt of pointsToCheck) {
                if (!pt) continue;
                const px = Math.floor(pt[0]);
                const py = Math.floor(pt[1]);

                // Draw filled circle
                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        if (dx * dx + dy * dy <= radius * radius) {
                            const idx = ((py + dy) * width + (px + dx)) * 4;
                            if (idx >= 0 && idx < data.length) {
                                // Darken by 90% (Deep Anchor)
                                data[idx] = Math.floor(data[idx] * 0.1);
                                data[idx + 1] = Math.floor(data[idx + 1] * 0.1);
                                data[idx + 2] = Math.floor(data[idx + 2] * 0.1);
                            }
                        }
                    }
                }
            }
        }

        // 3. Extract Face Region (Now with injected features)
        const faceRegion = await mainImage
            .clone()
            .extract({ left: x, top: y, width: w, height: h })
            .toBuffer();

        // 4. SMART SUPER-SAMPLING
        let pipe = sharp(faceRegion, { raw: { width: w, height: h, channels: 4 } })
            .resize(w * 4, h * 4, { kernel: 'cubic' });

        // Adaptive Enhancement (Toned Down)
        if (contrastRange < 80) {
            // LOW CONTRAST
            pipe = pipe.normalise();
        }

        // Sharpen
        const processedFace = await pipe
            .sharpen({ sigma: 1.5, m1: 0, m2: 3, x1: 2, y2: 10, y3: 20 })
            .resize(w, h, { kernel: 'lanczos3' })
            .raw()
            .toBuffer();

        // 5. FEATHERED BLENDING (Ellipse Mask)
        // Create an Alpha Mask that is 255 in center, fading to 0 at corners
        // We do this manually to ensure organic blending
        const maskBuffer = Buffer.alloc(w * h);
        const cx = w / 2;
        const cy = h / 2;
        const rx = Math.max(1, w / 2);
        const ry = Math.max(1, h / 2);

        for (let my = 0; my < h; my++) {
            for (let mx = 0; mx < w; mx++) {
                // Normalized distance
                const dx = (mx - cx) / rx;
                const dy = (my - cy) / ry;
                const distSq = dx * dx + dy * dy;

                let alpha = 255;
                if (distSq > 1.0) {
                    alpha = 0; // Outside ellipse
                } else if (distSq > 0.6) {
                    // Feather zone (0.6 to 1.0) ~= last 20% of radius
                    // Map 0.6 -> 255, 1.0 -> 0
                    const t = (distSq - 0.6) / 0.4; // 0 to 1
                    // Smoothstep-ish
                    alpha = Math.floor(255 * (1 - t));
                }
                maskBuffer[my * w + mx] = alpha;
            }
        }

        // Apply Mask using Composition (dest-in)
        // This keeps the face (destination) where the mask (source) is opaque
        const maskedFace = await sharp(processedFace, { raw: { width: w, height: h, channels: 4 } })
            .composite([{
                input: maskBuffer,
                raw: { width: w, height: h, channels: 1 },
                blend: 'dest-in'
            }])
            .png() // Encode as PNG so mainImage.composite can auto-detect it
            .toBuffer();

        composites.push({
            input: maskedFace,
            top: y,
            left: x,
        });
    }

    if (composites.length > 0) {
        // Compose back onto main image
        const finalBuffer = await mainImage
            .composite(composites)
            .raw()
            .toBuffer();

        // Write back to original array
        // Uint8ClampedArray.set from Buffer
        data.set(new Uint8ClampedArray(finalBuffer));
    }
}
