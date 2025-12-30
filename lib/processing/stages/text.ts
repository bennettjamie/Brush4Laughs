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

    // Dynamic import to avoid server-side bundling issues if not handled by safeguards
    const sharp = (await import("sharp")).default;

    // DETAIL LOGIC:
    const textDetail = preprocess.textDetail ?? 0;

    // 1. Skip if detail is 0 (Off)
    if (textDetail <= 0) {
        console.log("[Text] Detail is 0 (Off). Skipping detection.");
        return [];
    }

    // 2. High-Res Mode Loop
    // Default Fast: 1500px (Better balance)
    // High Detail (>50): 2500px (Good for small text)
    // 2. High-Res Mode Loop
    // Default Fast: 1024px (Matches Face Detection)
    // High Detail (>50): 2048px (Compromise)
    const MAX_TEXT_WIDTH = textDetail > 50 ? 2048 : 1024;

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
    // Reduce Timeout to 10s for snappy performance
    const TIMEOUT_MS = 10000;
    let worker: Tesseract.Worker | null = null;
    let timeoutTimer: NodeJS.Timeout | null = null;

    try {
        console.log("[Text] Initializing Tesseract Worker...");

        const recognitionTask = (async () => {
            // Use 'eng' but Tesseract.js usually downloads the standard best.
            // We can't easily force "fast" without manual gzip download management in this env.
            // But 1024px + 10s timeout is the "Light" equivalent logic.
            worker = await Tesseract.createWorker("eng", 1, {
                errorHandler: (err) => console.error("[Text] Tesseract Error:", err)
            });
            console.log("[Text] Worker Ready. Recognizing...");
            return await worker!.recognize(pngBuffer as any);
        })();

        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutTimer = setTimeout(() => {
                reject(new Error("Text Detection Timeout (>15s)"));
            }, TIMEOUT_MS);
        });

        // @ts-ignore
        const ret = await Promise.race([recognitionTask, timeoutPromise]);

        if (timeoutTimer) clearTimeout(timeoutTimer);

        const boxes: TextBox[] = [];
        const resultData = (ret as any).data;

        if (resultData && resultData.words) {
            resultData.words.forEach((w: any) => {
                // Relaxed confidence (40) to catch artistic text
                if (w.confidence > 40) {
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
        return [];
    } finally {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (worker) {
            console.log("[Text] Terminating Worker...");
            // @ts-ignore
            await worker.terminate();
        }
    }
}
