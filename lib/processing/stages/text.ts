import "server-only";
import Tesseract from 'tesseract.js';
import { PreprocessResult } from '../types';

export interface TextBox {
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    confidence: number;
}

export async function runTextDetection(preprocess: PreprocessResult): Promise<TextBox[]> {
    const { data, width, height } = preprocess;

    console.log("[Text] Starting Text Detection...");

    // Convert raw buffer to a format Tesseract handles (ImageData-like or Buffer)
    // Tesseract.js in Node accepts Buffer directly if we provide dimensions? 
    // Actually, it's easier to pass the buffer, but `recognize` expects an image-like object.

    // We can pass the raw buffer if we wrap it or just use the raw data?
    // Let's rely on Tesseract's ability to handle raw data if we pass proper options or headers.
    // Simpler: Use Sharp to encode to a robust format (PNG) then pass buffer. 
    // Wait, we don't have Sharp here, it's upstream. 
    // But we have `sharp` in dependency. Let's import it to make a PNG buffer.

    // Correction: We do not want to add heavy imports if avoidable, but Sharp is already used in `refinement.ts`? 
    // No, `refinement` uses `sharp` only implicitly via pipeline structure? 
    // Actually `preprocess.ts` uses Sharp. We can import sharp here.

    const sharp = (await import("sharp")).default;

    // DETAIL LOGIC:
    const textDetail = preprocess.textDetail ?? 0;

    // 1. Skip if detail is 0 (Off)
    if (textDetail <= 0) {
        console.log("[Text] Detail is 0 (Off). Skipping detection.");
        return [];
    }

    // 2. High-Res Mode Loop
    // Default Fast: 1024px (Good for headlines)
    // High Detail (>50): 2048px (Good for small text)
    const MAX_TEXT_WIDTH = textDetail > 50 ? 2500 : 1024;

    let detectionWidth = width;
    let detectionHeight = height;
    let scaleFactor = 1.0;
    let pipeline = sharp(data, {
        raw: {
            width,
            height,
            channels: 4
        }
    });

    if (width > MAX_TEXT_WIDTH) {
        scaleFactor = MAX_TEXT_WIDTH / width;
        detectionWidth = MAX_TEXT_WIDTH;
        detectionHeight = Math.round(height * scaleFactor);

        console.log(`[Text] Downscaling for Speed/Detail (${textDetail}%): ${width}x${height} -> ${detectionWidth}x${detectionHeight}`);
        pipeline = pipeline.resize(detectionWidth, detectionHeight);
    }

    const pngBuffer = await pipeline.png().toBuffer();

    // WRAPPER: Timeout Protection
    // If Tesseract takes > 15 seconds, we abort. It's better to lose text protection than hang the app.
    const TIMEOUT_MS = 15000;
    let worker: Tesseract.Worker | null = null;
    let timeoutTimer: NodeJS.Timeout | null = null;

    try {
        console.log("[Text] Initializing Tesseract Worker...");

        // Race Worker Creation + Recognition against a Timer
        const recognitionTask = (async () => {
            worker = await Tesseract.createWorker("eng", 1, {
                errorHandler: (err) => console.error("[Text] Tesseract Error:", err)
            });
            console.log("[Text] Worker Ready. Recognizing...");
            return await worker.recognize(pngBuffer as any);
        })();

        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutTimer = setTimeout(() => {
                reject(new Error("Text Detection Timeout (>15s)"));
            }, TIMEOUT_MS);
        });

        // @ts-ignore - Promise.race types can be tricky with never
        const ret = await Promise.race([recognitionTask, timeoutPromise]);

        if (timeoutTimer) clearTimeout(timeoutTimer);

        const boxes: TextBox[] = [];
        // Force type check bypass for 'words' property which exists at runtime
        const data = (ret as any).data;

        if (data && data.words) {
            data.words.forEach((w: any) => {
                // Relaxed confidence slightly to catch artistic text
                if (w.confidence > 50) {
                    boxes.push({
                        x: w.bbox.x0 / scaleFactor,
                        y: w.bbox.y0 / scaleFactor,
                        width: (w.bbox.x1 - w.bbox.x0) / scaleFactor,
                        height: (w.bbox.y1 - w.bbox.y0) / scaleFactor,
                        text: w.text,
                        confidence: w.confidence
                    });
                }
            });
        }

        console.log(`[Text] Success! Detected ${boxes.length} word(s).`);
        return boxes;

    } catch (e) {
        console.warn("[Text] Skipped:", e);
        return []; // Return empty on timeout/fail to keep pipeline alive
    } finally {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (worker) {
            console.log("[Text] Terminating Worker...");
            // @ts-ignore
            await worker.terminate();
        }
    }
}
