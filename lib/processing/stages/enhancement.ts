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
            // LOW CONTRAST (Kid)
            // Still force stretch, but slightly less aggressive sharpen
            pipe = pipe.normalise();
        } else {
            // HIGH CONTRAST (Dad)
            // NATIVE: Do nothing. Trust the input image.
            // This is the "Down a notch" request.
            // Previous: pipe = pipe.modulate({ brightness: 1.02, saturation: 1.1 });
        }

        // Sharpen (Reduced from 2 to 1.5 to be less "scratchy")
        const processedFace = await pipe
            .sharpen({ sigma: 1.5, m1: 0, m2: 3, x1: 2, y2: 10, y3: 20 })
            .resize(w, h, { kernel: 'lanczos3' })
            .toBuffer();

        composites.push({
            input: processedFace,
            top: y,
            left: x
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
