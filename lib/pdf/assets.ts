import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

export async function loadImage(url: string): Promise<Buffer> {
    // 1. Check for public relative paths (Prioritize these!)
    // We normalize to ignore windows/unix slash differences if needed, but string check is usually fine for these hardcoded paths
    if (url.startsWith("/uploads/") || url.startsWith("/brush") || url.startsWith("/palette")) {
        const filePath = path.join(process.cwd(), "public", url);
        console.log(`[Assets] Loading from filesystem: ${filePath}`);
        return await fs.readFile(filePath);
    }

    // 2. Check if it is already an absolute path string
    if (path.isAbsolute(url)) {
        return await fs.readFile(url);
    }

    // 3. Last ditch: try to read it relative to cwd
    try {
        return await fs.readFile(path.resolve(process.cwd(), url));
    } catch (e) {
        // Fallthrough
    }

    throw new Error(`Cannot load image: ${url}`);
}

export async function loadOptimizedImage(url: string, maxDim: number = 2500): Promise<Buffer> {
    const rawBuffer = await loadImage(url);
    try {
        const image = sharp(rawBuffer);
        const metadata = await image.metadata();

        if (metadata.width && metadata.height && (metadata.width > maxDim || metadata.height > maxDim)) {
            console.log(`Optimizing image ${url} for PDF (resize to ${maxDim}px)`);
            return await image.resize(maxDim, maxDim, { fit: 'inside' }).png().toBuffer();
        }
        return rawBuffer;
    } catch (e) {
        console.warn(`Failed to optimize image ${url}, using raw`, e);
        return rawBuffer;
    }
}
