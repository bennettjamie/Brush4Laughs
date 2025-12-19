import jsPDF from "jspdf";

export type PaletteItem = {
    color: string;
    name: string;
    amount: number;
    percentage: number;
};

export type LabelItem = {
    x: number;
    y: number;
    index: number;
    fontSize?: number;
};

export async function generatePDF(
    outlineUrl: string,
    resultUrl: string,
    originalUrl: string | null,
    palette: PaletteItem[],
    labels: LabelItem[],
    dimensions: { width: number; height: number },
    unit: "ml" | "oz",
    printSize: { width: number; height: number; name: string },
    customDim: { width: number; height: number },
    colorOpacity: number
) {
    if (!resultUrl || !palette.length) return;

    try {
        const GState = (jsPDF as any).GState;

        // Helper to load image
        const loadImage = (url: string) => {
            return new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new window.Image();
                img.crossOrigin = "anonymous";
                img.src = url;
                img.onload = () => resolve(img);
                img.onerror = (e) => reject(new Error(`Failed to load image at ${url}`));
            });
        };

        const loadPromises = [loadImage(outlineUrl), loadImage(resultUrl)];
        if (originalUrl) loadPromises.push(loadImage(originalUrl));

        const images = await Promise.all(loadPromises);
        const outlineImg = images[0];
        const resultImg = images[1];
        const originalImg = images.length > 2 ? images[2] : null;

        // --- PDF 1: The Canvas (Large, Print Size) ---
        let printW = 0, printH = 0;
        if (printSize.name === "Custom") {
            printW = customDim.width * 25.4;
            printH = customDim.height * 25.4;
        } else {
            printW = printSize.width * 25.4;
            printH = printSize.height * 25.4;
        }

        const margin = 20;

        const imgAspect = resultImg.width / resultImg.height;
        const isLandscape = imgAspect > 1;

        if (isLandscape && printW < printH) {
            [printW, printH] = [printH, printW];
        } else if (!isLandscape && printW > printH) {
            [printW, printH] = [printH, printW];
        }

        const docCanvas = new jsPDF({
            unit: "mm",
            format: [printW, printH],
            orientation: isLandscape ? "landscape" : "portrait"
        });

        // 1. Optional Background Fill
        if (colorOpacity > 0 && GState) {
            docCanvas.saveGraphicsState();
            docCanvas.setGState(new GState({ opacity: colorOpacity / 100 }));
            docCanvas.addImage(resultImg, "PNG", 0, 0, printW, printH);
            docCanvas.restoreGraphicsState();
        }

        // 2. Outline
        docCanvas.addImage(outlineImg, "PNG", 0, 0, printW, printH);

        // 3. Numbers
        const scaleX = printW / dimensions.width;
        const scaleY = printH / dimensions.height;
        const scale = Math.min(scaleX, scaleY);

        const finalW = dimensions.width * scale;
        const finalH = dimensions.height * scale;
        const xOff = (printW - finalW) / 2;
        const yOff = (printH - finalH) / 2;

        labels.forEach((label) => {
            const lx = xOff + (label.x * scale);
            const ly = yOff + (label.y * scale);
            let fontSize = label.fontSize ? (label.fontSize * 16) : 8;
            fontSize = Math.max(4.0, Math.min(14, fontSize));

            docCanvas.setFontSize(fontSize);
            docCanvas.setFont("helvetica", "normal");
            docCanvas.setTextColor(120, 120, 120);
            docCanvas.text(`${label.index}`, lx, ly, { align: "center", baseline: "middle" });
        });

        // 4. Studio Branding
        const logo = await loadImage("/brush_only.png");
        const logoSize = 10;
        const logoX = printW / 2 - 45;
        const logoY = printH - 12;

        docCanvas.addImage(logo, "PNG", logoX, logoY, logoSize, logoSize);

        docCanvas.setFontSize(14);
        docCanvas.setFont("helvetica", "bold");
        docCanvas.setTextColor(220, 220, 220); // Faint for painting over
        docCanvas.text("Brush4Laughs", logoX + logoSize + 2, logoY + 5.5);

        docCanvas.setFontSize(7);
        docCanvas.setFont("helvetica", "bold");
        docCanvas.setTextColor(99, 102, 241); // Indigo 500
        docCanvas.text("STUDIO EDITION", logoX + logoSize + 2.2, logoY + 8.5, { charSpace: 1 });

        docCanvas.setFontSize(8);
        docCanvas.setFont("helvetica", "normal");
        docCanvas.setTextColor(150, 150, 150);
        docCanvas.text("Custom Masterpiece Canvas", logoX + logoSize + 42, logoY + 7);

        // Fun Social Prompt
        docCanvas.setFontSize(6);
        docCanvas.setFont("helvetica", "italic");
        docCanvas.setTextColor(180, 180, 180);
        docCanvas.text("Snap a photo of your progress! Tag us @Brush4Laughs", printW - margin, logoY + 12, { align: "right" });

        docCanvas.setDrawColor(230, 230, 230);
        docCanvas.setLineWidth(0.1);
        docCanvas.line(margin, printH - 15, printW - margin, printH - 15);

        docCanvas.save("Brush4Laughs-Canvas.pdf");

        // --- PDF 2: The Guide (Letter) ---
        const docGuide = new jsPDF({
            unit: "mm",
            format: "letter",
            orientation: "portrait"
        });

        const guideW = docGuide.internal.pageSize.getWidth();
        const guideH = docGuide.internal.pageSize.getHeight();

        const addGuideBranding = (d: jsPDF) => {
            const w = d.internal.pageSize.getWidth();
            const h = d.internal.pageSize.getHeight();

            // Subtle Logo Watermark
            d.saveGraphicsState();
            try {
                if (GState) d.setGState(new GState({ opacity: 0.03 }));
                d.addImage(logo, "PNG", w / 2 - 50, h / 2 - 50, 100, 100);
            } catch (e) { }
            d.restoreGraphicsState();

            // Footer
            d.setFontSize(8);
            d.setFont("helvetica", "bold");
            d.setTextColor(200, 200, 200);
            d.text("BRUSH4LAUGHS STUDIO EDITION", w / 2, h - 8, { align: "center", charSpace: 1 });

            d.setFontSize(7);
            d.setFont("helvetica", "normal");
            d.setTextColor(220, 220, 220);
            d.text("PROFESSIONAL ART KIT GUIDE • FOR STUDIO RESIDENCY USE ONLY", w / 2, h - 12, { align: "center" });
        };

        // PAGE 1: Professional Studio Orchestration
        // Background Accent
        docGuide.setFillColor(2, 6, 23); // Slate 950
        docGuide.rect(0, 0, guideW, 100, "F");

        docGuide.addImage(logo, "PNG", guideW / 2 - 15, 20, 30, 30);

        docGuide.setFontSize(42);
        docGuide.setTextColor(255, 255, 255);
        docGuide.setFont("helvetica", "bold");
        docGuide.text("Studio Guide", guideW / 2, 65, { align: "center" });

        docGuide.setFontSize(9);
        docGuide.setTextColor(99, 102, 241); // Indigo 400
        docGuide.text("BRUSH4LAUGHS STUDIO EDITION", guideW / 2, 72, { align: "center", charSpace: 2 });

        docGuide.setFontSize(14);
        docGuide.setTextColor(100, 100, 100);
        docGuide.setFont("helvetica", "normal");
        docGuide.text("Your Artist Residency Orchestration Checklist", guideW / 2, 115, { align: "center" });

        const instructions = [
            { head: "I. THE CURATED STUDIO", desc: "Select a workspace with optimal natural light and zero distractions. Your masterpiece requires focus." },
            { head: "II. PIGMENT PREPARATION", desc: "Reference the Studio Palette (final page) for precise volume requirements for each color index." },
            { head: "III. DEPTH SYNTHESIS", desc: "Identify subtle micro-regions by cross-referencing with the high-fidelity Original Photo (page 2)." },
            { head: "IV. THE BRUSH PROTOCOLS", desc: "Apply pigments in thin layers. Build opacity slowly, starting with darker indices for structural shadow." },
            { head: "V. BLENDING SYMPHONY", desc: "Dotted lines indicate soft-edge transitions. Use a dry brush to blend these for the Studio look." }
        ];

        let currentY = 135;
        instructions.forEach((line) => {
            docGuide.setFontSize(11);
            docGuide.setFont("helvetica", "bold");
            docGuide.setTextColor(30, 30, 30);
            docGuide.text(line.head, margin, currentY);

            docGuide.setFontSize(10);
            docGuide.setFont("helvetica", "normal");
            docGuide.setTextColor(80, 80, 80);
            const lines = docGuide.splitTextToSize(line.desc, guideW - (margin * 2));
            docGuide.text(lines, margin, currentY + 6);
            currentY += 18;
        });

        addGuideBranding(docGuide);

        // PAGE 2: Original Photo
        if (originalImg) {
            docGuide.addPage("letter", isLandscape ? "landscape" : "portrait");
            const pW = docGuide.internal.pageSize.getWidth();
            const pH = docGuide.internal.pageSize.getHeight();

            docGuide.setFontSize(14);
            docGuide.setTextColor(120, 120, 120);
            docGuide.setFont("helvetica", "bold");
            docGuide.text("Studio Reference: Original Photo", 15, 15);

            const availW = pW - 30;
            const availH = pH - 40;
            const origAspect = originalImg.width / originalImg.height;

            let drawW = availW;
            let drawH = availW / origAspect;
            if (drawH > availH) {
                drawH = availH;
                drawW = drawH * origAspect;
            }

            docGuide.addImage(originalImg, "JPEG", (pW - drawW) / 2, 25, drawW, drawH);
            addGuideBranding(docGuide);
        }

        // PAGE 3: Vector Reference
        docGuide.addPage("letter", isLandscape ? "landscape" : "portrait");
        const pW2 = docGuide.internal.pageSize.getWidth();
        const pH2 = docGuide.internal.pageSize.getHeight();

        docGuide.setFontSize(14);
        docGuide.setTextColor(120, 120, 120);
        docGuide.text("Studio Reference: Painted Result", 15, 15);

        const availW2 = pW2 - 30;
        const availH2 = pH2 - 40;
        let drawW2 = availW2;
        let drawH2 = availW2 / imgAspect;
        if (drawH2 > availH2) {
            drawH2 = availH2;
            drawW2 = drawH2 * imgAspect;
        }
        docGuide.addImage(resultImg, "PNG", (pW2 - drawW2) / 2, 25, drawW2, drawH2);
        addGuideBranding(docGuide);

        // PAGE 4: High-Capacity Artist Palette
        docGuide.addPage("letter", "portrait");
        const palW = docGuide.internal.pageSize.getWidth();
        const palH = docGuide.internal.pageSize.getHeight();
        const paletteImgW = palW * 0.72;
        const paletteImgH = paletteImgW * 0.82;
        const palX = (palW - paletteImgW) / 2;
        const palY = (palH - paletteImgH) / 2 - 15;

        try {
            const paletteBase = await loadImage("/palette_base.png");
            docGuide.addImage(paletteBase, "PNG", palX, palY, paletteImgW, paletteImgH);
        } catch (e) { console.warn(e) }

        // Studio Title
        docGuide.setFontSize(28);
        docGuide.setTextColor(40, 40, 40);
        docGuide.setFont("helvetica", "bold");
        docGuide.text("Studio Palette", palW / 2, palY + (paletteImgH * 0.44), { align: "center" });

        docGuide.setFontSize(8);
        docGuide.setTextColor(99, 102, 241); // Indigo 500
        docGuide.text("PROFESSIONAL PIGMENT ORCHESTRATION", palW / 2, palY + (paletteImgH * 0.44) + 6, { align: "center", charSpace: 1 });

        const pcx = palW / 2;
        const pcy = palY + (paletteImgH / 2);
        const startAngle = Math.PI * 0.9;
        const totalAngle = Math.PI * 1.5;
        const count = palette.length;

        const useDualRing = count > 24;
        const outerLimit = useDualRing ? Math.ceil(count * 0.6) : count;
        const innerLimit = count - outerLimit;

        const outerRx = (paletteImgW / 2) * 0.76;
        const outerRy = (paletteImgH / 2) * 0.76;
        const innerRx = (paletteImgW / 2) * 0.52;
        const innerRy = (paletteImgH / 2) * 0.52;

        palette.forEach((item, i) => {
            const isInner = useDualRing && i >= outerLimit;
            const rowIndex = isInner ? i - outerLimit : i;
            const rowTotal = isInner ? innerLimit : outerLimit;
            const stepAngle = totalAngle / Math.max(1, rowTotal - 1);

            const theta = startAngle + (rowIndex * stepAngle);
            const curRx = isInner ? innerRx : outerRx;
            const curRy = isInner ? innerRy : outerRy;

            const bx = pcx + curRx * Math.cos(theta);
            const by = pcy + curRy * Math.sin(theta);

            if (GState) {
                docGuide.saveGraphicsState();
                docGuide.setGState(new GState({ opacity: 0.12 }));
                docGuide.setFillColor(0, 0, 0);
                docGuide.circle(bx + 0.6, by + 1.0, 5.2, "F");
                docGuide.restoreGraphicsState();
            }

            docGuide.setFillColor(item.color);
            docGuide.setDrawColor(255, 255, 255);
            docGuide.setLineWidth(0.1);
            docGuide.circle(bx, by, 4.8, "FD");

            if (GState) {
                docGuide.saveGraphicsState();
                docGuide.setGState(new GState({ opacity: 0.4 }));
                docGuide.setFillColor(255, 255, 255);
                docGuide.circle(bx - 1.5, by - 1.5, 2, "F");
                docGuide.setGState(new GState({ opacity: 0.15 }));
                docGuide.circle(bx + 1, by + 1, 1, "F");
                docGuide.restoreGraphicsState();
            }

            const labelRx = (paletteImgW / 2) + 12;
            const labelRy = (paletteImgH / 2) + 12;
            const lx = pcx + labelRx * Math.cos(theta);
            const ly = pcy + labelRy * Math.sin(theta);

            if (GState) {
                docGuide.saveGraphicsState();
                docGuide.setGState(new GState({ opacity: 0.1 }));
                docGuide.setDrawColor(100, 100, 100);
                docGuide.setLineWidth(0.15);
                docGuide.line(bx, by, lx, ly);
                docGuide.restoreGraphicsState();
            }

            docGuide.setFontSize(count > 32 ? 9 : 11);
            docGuide.setFont("helvetica", "bold");
            docGuide.setTextColor(60, 60, 60);
            docGuide.text(`${i + 1}`, lx, ly, { align: "center", baseline: "middle" });

            const iy = ly + 4.5;
            docGuide.setFontSize(count > 32 ? 5.5 : 6.5);
            docGuide.setTextColor(120, 120, 120);

            const safeAmount = (unit === "ml" ? item.amount : item.amount * 0.0338) * 1.15;
            const amountStr = `${Math.round(safeAmount * 10) / 10}${unit}`;
            const displayName = item.name.length > 15 ? item.name.substring(0, 12) + ".." : item.name;

            docGuide.text(`${displayName} (${amountStr})`, lx, iy, { align: "center" });
        });

        addGuideBranding(docGuide);
        docGuide.save("Brush4Laughs-Guide.pdf");

    } catch (error: any) {
        console.error("PDF Generation Error:", error);
        throw error;
    }
}
