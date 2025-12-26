import { jsPDF, GState } from "jspdf";

// Helper to load image in browser
async function loadBrowserImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
    });
}

export async function generateClientCanvasPDF(
    outlineUrl: string,
    resultUrl: string,
    opacity: number,
    labels: { x: number; y: number; index: number; fontSize?: number }[],
    dimension: { width: number; height: number },
    customDim?: { width: number; height: number },
    options?: { mirror?: boolean }
): Promise<jsPDF> {
    const targetW = customDim?.width || 20;
    const targetH = customDim?.height || 24;
    const orientation = targetW > targetH ? "landscape" : "portrait";

    // RASTER MIRROR PATH (Robust)
    if (options?.mirror) {
        // 1. Setup High-Res Canvas (300 DPI)
        const dpi = 300;
        const widthPx = targetW * dpi;
        const heightPx = targetH * dpi;

        const canvas = document.createElement("canvas");
        canvas.width = widthPx;
        canvas.height = heightPx;
        const ctx = canvas.getContext("2d");

        if (ctx) {
            // 2. Global Flip (and White Background)
            // Fix: JPEG export turns transparent pixels to black. 
            // We must fill the canvas with white before flipping.
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, widthPx, heightPx);

            ctx.translate(widthPx, 0);
            ctx.scale(-1, 1);

            // 3. Draw Content
            // Background
            if (opacity > 0) {
                try {
                    const bgImg = await loadBrowserImage(resultUrl);
                    ctx.globalAlpha = opacity / 100;
                    ctx.drawImage(bgImg, 0, 0, widthPx, heightPx);
                    ctx.globalAlpha = 1.0;
                } catch (e) { }
            }

            // Outline
            try {
                const outImg = await loadBrowserImage(outlineUrl);
                ctx.drawImage(outImg, 0, 0, widthPx, heightPx);
            } catch (e) { }

            // Labels
            const scaleX = widthPx / dimension.width;
            const scaleY = heightPx / dimension.height;

            ctx.font = "bold 20px Helvetica"; // Baseline
            ctx.fillStyle = "rgb(100, 130, 160)";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            labels.forEach(label => {
                const lx = label.x * scaleX;
                const ly = label.y * scaleY;
                // Font Size Map: 0.25 -> 5pt (20px at 300dpi is huge? No. 5pt is ~20px at 300dpi)
                // 1pt = 1/72 inch. 1 inch = 300 px. So 1pt = 4.16 px.
                // 5pt = 20.8px. Correct.
                const ptSize = Math.max(4, Math.min(16, (label.fontSize || 0.5) * 14));
                const pxSize = ptSize * (300 / 72);

                ctx.font = `bold ${pxSize}px Helvetica`;
                ctx.fillText(`${label.index}`, lx, ly);
            });

            // Watermark
            try {
                const logo = await loadBrowserImage("/brush_only.png");
                const logoPx = 0.8 * dpi;
                const marginPx = 0.5 * dpi;
                ctx.globalAlpha = 0.3;
                // For flipped context: coordinates are still logical 0..width
                // We want it bottom-right (which is visually bottom-left after flip?)
                // No, context logic: 0 is right, width is left.
                // Wait. We flipped: x' = width - x.
                // If we draw at (width - margin - size), that is logical right.
                // Flipped, it appears on the physical Left. 
                // Wait, "Reverse" means standard mirror.
                // Left becomes Right. Right becomes Left.
                // We want the logo to be readable? No, logo should be mirrored too.
                // So drawing it at logical bottom-right (standard) means it ends up at physical bottom-left (mirrored). Correct.
                ctx.drawImage(logo, widthPx - marginPx - logoPx, heightPx - marginPx - logoPx, logoPx, logoPx);
                ctx.globalAlpha = 1.0;
            } catch (e) { }

            // Footer
            ctx.font = `${6 * (300 / 72)}px Helvetica`;
            ctx.fillStyle = "rgb(150, 150, 150)";
            ctx.textAlign = "left";
            const dateStr = new Date().toLocaleDateString();
            const footer = `Brush4Laughs Studio • ${targetW}" x ${targetH}" • Generated ${dateStr}`;
            ctx.fillText(footer, 0.5 * dpi, heightPx - 0.5 * dpi);

            // 4. Export to PDF (As Image)
            const doc = new jsPDF({
                orientation,
                unit: "in",
                format: [targetW, targetH]
            });
            const imgData = canvas.toDataURL("image/jpeg", 0.85); // JPEG to save size, 85% quality
            doc.addImage(imgData, "JPEG", 0, 0, targetW, targetH);
            return doc;
        }
    }

    // STANDARD VECTOR PATH (Unchanged)
    const doc = new jsPDF({
        orientation,
        unit: "in",
        format: [targetW, targetH]
    });

    // 1. Background (Result Image)
    if (opacity > 0) {
        try {
            const img = await loadBrowserImage(resultUrl);
            if (GState) {
                doc.saveGraphicsState();
                doc.setGState(new GState({ opacity: opacity / 100 }));
                doc.addImage(img, "PNG", 0, 0, targetW, targetH);
                doc.restoreGraphicsState();
            }
        } catch (e) { console.warn("Background load failed", e); }
    }

    // 2. Outline
    try {
        const img = await loadBrowserImage(outlineUrl);
        doc.addImage(img, "PNG", 0, 0, targetW, targetH);
    } catch (e) { console.error("Outline load failed", e); }

    // 3. Labels
    const scaleX = targetW / dimension.width;
    const scaleY = targetH / dimension.height;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 130, 160);

    labels.forEach(label => {
        const lx = (label.x * scaleX);
        const ly = (label.y * scaleY);
        // Map fontSize 0.25->5pt, 1.0->14pt
        const ptSize = Math.max(4, Math.min(16, (label.fontSize || 0.5) * 14));
        doc.setFontSize(ptSize);
        doc.text(`${label.index}`, lx, ly, { align: "center", baseline: "middle" });
    });

    // 4. Branding (Watermark)
    try {
        const logo = await loadBrowserImage("/brush_only.png");
        const logoSize = 0.8;
        const margin = 0.5;
        if (GState) {
            doc.saveGraphicsState();
            doc.setGState(new GState({ opacity: 0.3 }));
            doc.addImage(logo, "PNG", targetW - margin - logoSize, targetH - margin - logoSize, logoSize, logoSize);
            doc.restoreGraphicsState();
        }
    } catch (e) { }

    // Footer
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    const dateStr = new Date().toLocaleDateString();
    doc.text(`Brush4Laughs Studio • ${targetW}" x ${targetH}" • Generated ${dateStr}`, 0.5, targetH - 0.5);

    return doc;
}
