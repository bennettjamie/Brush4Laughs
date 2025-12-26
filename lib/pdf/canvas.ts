import { jsPDF, GState } from "jspdf";
import { loadImage, loadOptimizedImage } from "./assets";

export async function generateCanvasPDF(
    outlineUrl: string,
    resultUrl: string, // The color image
    opacity: number, // User's opacity setting (0-100)
    labels: { x: number; y: number; index: number; fontSize?: number; light?: boolean }[],
    dimension: { width: number; height: number },
    customDim?: { width: number; height: number }
): Promise<jsPDF> {
    const targetW = customDim?.width || 20;
    const targetH = customDim?.height || 24;

    // Explicitly determine orientation to prevent auto-swapping or default portrait mode
    const orientation = targetW > targetH ? "landscape" : "portrait";

    // Use exact dimensions requested by the user
    const docCanvas = new jsPDF({
        orientation,
        unit: "in",
        format: [targetW, targetH]
    });

    // 1. Background Fill (Optional backing mainly for screen viewing, but paper is white)
    // Actually, leave it transparent/white so it prints clean.

    // 2. Draw Faded "Underpainting" (The Result Image)
    // This allows opacity to show through as requested.
    if (opacity > 0) {
        try {
            const resultImg = await loadOptimizedImage(resultUrl, 2000); // Optimize to 2000px
            // Full Bleed for Background matching Outline
            if (GState) {
                docCanvas.saveGraphicsState();
                docCanvas.setGState(new GState({ opacity: opacity / 100 }));
                // Draw exactly same as outline
                docCanvas.addImage(resultImg, "PNG", 0, 0, targetW, targetH);
                docCanvas.restoreGraphicsState();
            }
        } catch (e) { console.warn("Background load failed", e); }
    }

    // 3. Draw Outline Image (Black Lines) - 100% Opacity
    // Needs to align PERFECTLY with the background.
    // FULL BLEED: Draw exactly at 0,0 with targetW, targetH
    let drawW = targetW;
    let drawH = targetH;
    let startX = 0;
    let startY = 0;

    // Use strictly the requested dimensions. If the aspect ratio of the image differs slightly from the page,
    // we still fill the page (distort) OR fit? 
    // User requested "actual dimensions". Usually implies the image IS the canvas.
    // So we force fit.

    const outlineImg = await loadOptimizedImage(outlineUrl, 2500); // Keep lines sharper
    docCanvas.addImage(outlineImg, "PNG", startX, startY, drawW, drawH);

    // 4. Draw Number Labels
    const scaleX = drawW / dimension.width;
    const scaleY = drawH / dimension.height;

    docCanvas.setFont("helvetica", "bold");

    // Use a color that is visible but not overpowering
    docCanvas.setTextColor(100, 130, 160); // Slate Blue

    labels.forEach(label => {
        const lx = startX + (label.x * scaleX);
        const ly = startY + (label.y * scaleY);

        // Adjust Font Size for readability
        // Base: 12pt for a medium region?
        // label.fontSize from pipeline is relative factor (0.25 to 1.1)
        // Let's map it: 0.25 -> 5pt, 1.0 -> 10pt
        // 5pt minimum, max 16pt
        const ptSize = Math.max(4, Math.min(16, (label.fontSize || 0.5) * 14));

        docCanvas.setFontSize(ptSize);
        docCanvas.text(`${label.index}`, lx, ly, { align: "center", baseline: "middle" });
    });

    // 5. Minimalist Branding
    const logoSize = 0.8;
    const margin = 0.5;

    // Corner Logo
    try {
        const logo = await loadImage("/brush_only.png");
        const logoX = targetW - margin - logoSize;
        const logoY = targetH - margin - logoSize;

        if (GState) {
            docCanvas.saveGraphicsState();
            docCanvas.setGState(new GState({ opacity: 0.3 })); // Discrete
            docCanvas.addImage(logo, "PNG", logoX, logoY, logoSize, logoSize);
            docCanvas.restoreGraphicsState();
        }
    } catch (e) { }

    // Footer Info (Very Small)
    docCanvas.setFontSize(6);
    docCanvas.setTextColor(150, 150, 150);
    docCanvas.setFont("helvetica", "normal");
    const dateStr = new Date().toLocaleDateString();

    // Bottom Left
    docCanvas.text(`Brush4Laughs Studio • ${targetW}" x ${targetH}" • Generated ${dateStr}`, margin, targetH - margin);

    return docCanvas;
}
