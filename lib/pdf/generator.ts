import { generateCanvasPDF } from "./canvas";
import { generateGuidePDF } from "./guide";

export async function generatePDF(
    originalUrl: string | undefined, // Not used for Canvas, used for Guide
    outlineUrl: string,
    outputUrl: string, // The posterized result
    palette: { color: string; name: string; amount: number; percentage: number }[],
    labels: { x: number; y: number; index: number; fontSize?: number; light?: boolean }[],
    dimension: { width: number; height: number },
    customDim?: { width: number; height: number },
    opacity: number = 15, // Default opacity
    type?: "canvas" | "guide" | "kit" // Optional type filter
): Promise<{ fileName: string; data: Buffer }[]> {

    const results: { fileName: string; data: Buffer }[] = [];

    // 1. Generate Canvas PDF
    if (!type || type === "canvas" || type === "kit") {
        try {
            const canvasDoc = await generateCanvasPDF(outlineUrl, outputUrl, opacity, labels, dimension, customDim);
            const canvasBuffer = Buffer.from(canvasDoc.output("arraybuffer"));

            // Filename with dimensions
            const w = customDim?.width || 20;
            const h = customDim?.height || 24;
            const canvasName = `Brush4Laughs-Canvas-${w}x${h}.pdf`;

            results.push({
                fileName: canvasName,
                data: canvasBuffer
            });
        } catch (e) {
            console.error("Canvas Generation Failed", e);
            if (type === "canvas") throw e; // Re-throw if explicitly requested
        }
    }

    // 2. Generate Guide PDF
    if (!type || type === "guide" || type === "kit") {
        try {
            const guideDoc = await generateGuidePDF({
                originalUrl,
                posterizedUrl: outputUrl,
                outlineUrl,
                palette,
                unit: "ml",
                opacity,
                labels: labels as any,
                pixelDimension: dimension, // processed image pixels
                physicalDimension: customDim || { width: 20, height: 24 } // requested print inches
            });
            const guideBuffer = Buffer.from(guideDoc.output("arraybuffer"));

            results.push({
                fileName: "Brush4Laughs-Guide.pdf",
                data: guideBuffer
            });
        } catch (e) {
            console.error("Guide Generation Failed", e);
            if (type === "guide") throw e; // Re-throw if explicitly requested
        }
    }

    return results;
}
