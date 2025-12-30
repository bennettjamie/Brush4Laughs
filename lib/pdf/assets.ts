import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

export async function loadImage(url: string): Promise<Buffer> {
    const fs = require('fs');
    const path = require('path');

    // 0. Strip Domain if present to force local load
    let cleanUrl = url;
    if (url.startsWith("http")) {
        try {
            const u = new URL(url);
            cleanUrl = u.pathname;
        } catch (e) { }
    }

    console.log(`[Assets] Loading: ${cleanUrl} (orig: ${url})`);

    try {
        // 1. Check for public relative paths (Prioritize these!)
        if (cleanUrl.startsWith("/uploads/") || cleanUrl.startsWith("/brush") || cleanUrl.startsWith("/palette")) {
            // Remove leading slash for safer joining
            const relativePath = cleanUrl.startsWith("/") ? cleanUrl.slice(1) : cleanUrl;
            const filePath = path.join(process.cwd(), "public", relativePath);
            return await fs.promises.readFile(filePath);
        }

        // 2. Check if it is already an absolute path string
        if (path.isAbsolute(url)) {
            return await fs.promises.readFile(url);
        }

        // 3. Last ditch: try to read it relative to cwd
        return await fs.promises.readFile(path.resolve(process.cwd(), url));

    } catch (e) {
        console.error(`[Assets] FAILED to load: ${url}`, e);
        // Fallback: Return a 1x1 transparent PNG to prevent crash
        return Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
    }
}

export async function loadOptimizedImage(url: string, maxDim: number = 2500, format: "png" | "jpeg" = "png"): Promise<Buffer> {
    const fs = require('fs');
    const debugLog = path.join(process.cwd(), 'pdf-debug.log');

    try {
        fs.appendFileSync(debugLog, `[Assets] Optimizing: ${url} to ${format}\n`);
    } catch (e) { }

    const rawBuffer = await loadImage(url);
    try {
        // Enforce a timeout specifically for the sharp operation
        const optimizationPromise = (async () => {
            const image = sharp(rawBuffer);
            const metadata = await image.metadata();

            // Resize if needed OR if we need to change format
            const needsResize = metadata.width && metadata.height && (metadata.width > maxDim || metadata.height > maxDim);
            const needsFormat = format === "jpeg"; // Always process if JPEG requested to ensure compression

            if (needsResize || needsFormat) {
                try {
                    fs.appendFileSync(debugLog, `[Assets] Processing ${url}... (timeout 5s)\n`);
                } catch (e) { }

                let pipeline = image;
                if (needsResize) {
                    pipeline = pipeline.resize(maxDim, maxDim, { fit: 'inside' });
                }

                if (format === "jpeg") {
                    // White background for JPEG to handle transparency
                    return await pipeline.flatten({ background: { r: 255, g: 255, b: 255 } }).jpeg({ quality: 80 }).toBuffer();
                } else {
                    return await pipeline.png().toBuffer();
                }
            }
            return rawBuffer;
        })();

        const timeoutPromise = new Promise<Buffer>((resolve) => {
            setTimeout(() => {
                try {
                    fs.appendFileSync(debugLog, `[Assets] TIMEOUT optimizing ${url}. Using placeholder.\n`);
                } catch (e) { }
                // Fallback: If optimization fails, use placeholder
                resolve(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"));
            }, 30000);
        });

        // Race them
        const result = await Promise.race([optimizationPromise, timeoutPromise]);
        try {
            if (result !== rawBuffer) fs.appendFileSync(debugLog, `[Assets] Optimization success: ${url}\n`);
        } catch (e) { }

        return result;

    } catch (e) {
        console.warn(`Failed to optimize image ${url}, using raw`, e);
        try {
            fs.appendFileSync(debugLog, `[Assets] Optimization CRASHED for ${url}: ${e}. Using raw.\n`);
        } catch (err) { }
        return rawBuffer;
    }
}
