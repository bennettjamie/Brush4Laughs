import sharp from "sharp";
import { ProcessingOptions, PreprocessResult } from "../types";

export async function runPreprocess(options: ProcessingOptions): Promise<PreprocessResult> {
    const { imagePath, complexity, customDim } = options;

    const pipeline = sharp(imagePath);
    // const metadata = await pipeline.metadata(); // Not strictly needed if we resize directly

    // 1a. Dynamic Resolution Scaling (Target 300 PPI for hairline precision)
    const targetPPI = 300;
    const targetInches = customDim?.width || 20;
    // Cap at 4000px to maintain server stability while allowing fine details
    const workingWidth = Math.min(4000, Math.max(3000, Math.round(targetInches * targetPPI)));

    let processedPipe = pipeline
        .resize({ width: workingWidth, fit: 'inside' })
        .ensureAlpha();

    // Apply blur based on complexity (Reduced for sharpness)
    if (complexity < 10) {
        // Minimal blur to keep crisp details
        const sigma = Math.max(0.3, (10 - complexity) / 5);
        processedPipe = processedPipe.blur(sigma);
    }

    const { data, info } = await processedPipe
        .raw()
        .toBuffer({ resolveWithObject: true });

    return {
        data,
        info,
        width: info.width,
        height: info.height,
        faceDetail: options.faceDetail,
        bodyDetail: options.bodyDetail,
        bgDetail: options.bgDetail,
        textDetail: options.textDetail
    };
}
