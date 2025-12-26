import { jsPDF, GState } from "jspdf";
import { loadImage, loadOptimizedImage } from "./assets";
import { getAcrylicRecipe } from "../colors/mixing"; // Import Mixing Logic

interface GuideOptions {
    originalUrl?: string; // Optional path to original Uploaded image
    posterizedUrl: string; // The "Painted Result"
    palette: { color: string; name: string; amount: number; percentage: number }[];
    unit?: "ml" | "oz";
}

export async function generateGuidePDF(options: GuideOptions): Promise<jsPDF> {
    const { originalUrl, posterizedUrl, palette, unit = "ml" } = options;

    const docGuide = new jsPDF({
        unit: "mm",
        format: "letter",
        orientation: "portrait"
    });

    const logo = await loadImage("/brush_only.png");

    const addGuideBranding = (d: jsPDF, landscape: boolean) => {
        const w = d.internal.pageSize.getWidth();
        const h = d.internal.pageSize.getHeight();

        // Header Logo (Small, Top Left)
        try {
            const lSize = 12;
            d.addImage(logo, "PNG", 10, 10, lSize, lSize);

            d.setFontSize(8);
            d.setFont("helvetica", "bold");
            d.setTextColor(50, 50, 50);
            d.text("Brush4Laughs Studio", 10 + lSize + 2, 16);

            d.setFontSize(6);
            d.setFont("helvetica", "normal");
            d.setTextColor(150, 150, 150);
            d.text("www.brush4laughs.com", 10 + lSize + 2, 19);
        } catch (e) { }

        // Footer
        d.setFontSize(7);
        d.setFont("helvetica", "bold");
        d.setTextColor(200, 200, 200);
        const footerText = "BRUSH4LAUGHS STUDIO EDITION • www.brush4laughs.com";
        d.text(footerText, w / 2, h - 10, { align: "center", charSpace: 1 });
    };

    // PAGE 1: Professional Studio Orchestration (Portrait)
    const guideW = docGuide.internal.pageSize.getWidth();
    addGuideBranding(docGuide, false);

    // Title Section
    docGuide.setFontSize(32);
    docGuide.setTextColor(20, 20, 20);
    docGuide.setFont("helvetica", "bold");
    docGuide.text("Studio Guide", guideW / 2, 50, { align: "center" });

    docGuide.setFontSize(10);
    docGuide.setTextColor(99, 102, 241); // Indigo 400
    docGuide.text("MASTERPIECE CREATION KIT", guideW / 2, 58, { align: "center", charSpace: 2 });

    docGuide.setDrawColor(200, 200, 200);
    docGuide.setLineWidth(0.1);
    docGuide.line(40, 65, guideW - 40, 65);

    // Checklist
    docGuide.setFontSize(14);
    docGuide.setTextColor(50, 50, 50);
    docGuide.setFont("helvetica", "bold");
    docGuide.text("Orchestration Checklist", 20, 85);

    const instructions = [
        { head: "I. THE CURATED STUDIO", desc: "Select a workspace with optimal natural light and zero distractions. Your masterpiece requires focus." },
        { head: "II. PIGMENT PREPARATION", desc: "You have two paths for pigment acquisition:\n1. ACQUIRE: Purchase premixed acrylics matching the provided color names.\n2. SYNTHESIZE: Use the reference chart (Page 4) to mix primary colors into the target hues. This builds hue sensitivity." },
        { head: "III. DEPTH SYNTHESIS", desc: "Identify subtle micro-regions by cross-referencing with the high-fidelity Original Photo (page 2)." },
        { head: "IV. THE BRUSH PROTOCOLS", desc: "Apply pigments in thin layers. Build opacity slowly, starting with darker indices for structural shadow." },
        { head: "V. BLENDING SYMPHONY", desc: "Dotted lines indicate soft-edge transitions. Use a dry brush to blend these for the Studio look." },
        { head: "VI. GEL TRANSFER PROTOCOL", desc: "To transfer the design to canvas:\n1. Open the 'Download Reverse' PDF.\n2. Print on standard laser/inkjet paper.\n3. Apply Gloss Gel Medium generously to the CANVAS (not paper).\n4. Place print FACE DOWN into the gel. Smooth out all air bubbles.\n5. Allow to dry thoroughly (24h).\n6. Dampen paper with water and gently rub off the paper pulp, leaving the ink embedded in the gel." }
    ];

    let currentY = 100;
    instructions.forEach((line) => {
        docGuide.setFontSize(10);
        docGuide.setFont("helvetica", "bold");
        docGuide.setTextColor(30, 30, 30);
        docGuide.text(line.head, 20, currentY);

        docGuide.setFontSize(9);
        docGuide.setFont("helvetica", "normal");
        docGuide.setTextColor(80, 80, 80);

        const lines = docGuide.splitTextToSize(line.desc, guideW - 40);
        docGuide.text(lines, 20, currentY + 5);

        currentY += (lines.length * 4) + 12;
    });

    // PAGE 2: Original Photo (No changes)
    if (originalUrl) {
        let originalImg;
        try {
            // OPTIMIZED LOAD
            originalImg = await loadOptimizedImage(originalUrl);
        } catch (e) { console.warn("Could not load original image", e); }

        if (originalImg) {
            const props = docGuide.getImageProperties(originalImg);
            const w = props.width;
            const h = props.height;
            const isLandscape = w > h;

            docGuide.addPage("letter", isLandscape ? "landscape" : "portrait");
            addGuideBranding(docGuide, isLandscape);

            const pW = docGuide.internal.pageSize.getWidth();
            const pH = docGuide.internal.pageSize.getHeight();

            docGuide.setFontSize(12);
            docGuide.setTextColor(100, 100, 100);
            docGuide.setFont("helvetica", "bold");
            docGuide.text("Ref 1: Original Photo", 15, 25);

            const availW = pW - 30;
            const availH = pH - 40;
            const imgAspect = w / h;

            let drawW = availW;
            let drawH = availW / imgAspect;
            if (drawH > availH) {
                drawH = availH;
                drawW = drawH * imgAspect;
            }

            docGuide.addImage(originalImg, "JPEG", (pW - drawW) / 2, 30, drawW, drawH);
        }
    }

    // PAGE 3: Vector Reference (No changes)
    try {
        // OPTIMIZED LOAD
        const resultImg = await loadOptimizedImage(posterizedUrl);
        const props = docGuide.getImageProperties(resultImg);
        const isResLandscape = props.width > props.height;

        docGuide.addPage("letter", isResLandscape ? "landscape" : "portrait");
        addGuideBranding(docGuide, isResLandscape);

        const pW2 = docGuide.internal.pageSize.getWidth();
        const pH2 = docGuide.internal.pageSize.getHeight();

        docGuide.setFontSize(12);
        docGuide.setTextColor(100, 100, 100);
        docGuide.setFont("helvetica", "bold");
        docGuide.text("Ref 2: Proposed Outcome", 15, 25);

        const availW2 = pW2 - 30;
        const availH2 = pH2 - 40;
        const imgAspect = props.width / props.height;
        let drawW2 = availW2;
        let drawH2 = availW2 / imgAspect;
        if (drawH2 > availH2) {
            drawH2 = availH2;
            drawW2 = drawH2 * imgAspect;
        }
        docGuide.addImage(resultImg, "PNG", (pW2 - drawW2) / 2, 30, drawW2, drawH2);
    } catch (e) { console.warn("Could not load result image", e); }


    // PAGE 4: High-Capacity Artist Palette (LANDSCAPE)
    docGuide.addPage("letter", "landscape");
    addGuideBranding(docGuide, true);

    const palW = docGuide.internal.pageSize.getWidth();
    const palH = docGuide.internal.pageSize.getHeight();

    const paletteImgW = palW * 0.5; // Smaller centered oval
    const paletteImgH = paletteImgW * 0.72;
    const palX = (palW - paletteImgW) / 2;
    const palY = (palH - paletteImgH) / 2 + 5;

    try {
        const paletteBase = await loadImage("/palette_base.png");
        docGuide.addImage(paletteBase, "PNG", palX, palY, paletteImgW, paletteImgH);
    } catch (e) { console.warn(e) }

    // Studio Title
    docGuide.setFontSize(24);
    docGuide.setTextColor(40, 40, 40);
    docGuide.setFont("helvetica", "bold");
    docGuide.text("Studio Palette", palW / 2, 35, { align: "center" });

    // Subtitle
    docGuide.setFontSize(10);
    docGuide.setTextColor(100, 100, 100);
    docGuide.setFont("helvetica", "normal");
    docGuide.text("Recipes based on standard 24-piece acrylic sets (Liquitex/Golden Basics)", palW / 2, 42, { align: "center" });

    // Palette Logic
    const pcx = palW / 2;
    const pcy = palY + (paletteImgH / 2);

    const ovalRx = (paletteImgW / 2) * 0.8;
    const ovalRy = (paletteImgH / 2) * 0.8;

    const labelRx = (paletteImgW / 2) * 1.4;
    const labelRy = (paletteImgH / 2) * 1.5;

    const startAngle = Math.PI;
    const totalAngle = Math.PI * 2;

    palette.forEach((item, i) => {
        const angle = startAngle + (i * (totalAngle / palette.length));

        const bx = pcx + ovalRx * Math.cos(angle);
        const by = pcy + ovalRy * Math.sin(angle);
        const lx = pcx + labelRx * Math.cos(angle);
        const ly = pcy + labelRy * Math.sin(angle);

        // Connection Line
        if (GState) {
            docGuide.saveGraphicsState();
            docGuide.setGState(new GState({ opacity: 0.2 }));
            docGuide.setDrawColor(150, 150, 150);
            docGuide.line(bx, by, lx, ly);
            docGuide.restoreGraphicsState();
        }

        // Dollop
        const dollopSize = 6.5;

        // Shadow
        if (GState) {
            docGuide.saveGraphicsState();
            docGuide.setGState(new GState({ opacity: 0.1 }));
            docGuide.setFillColor(0, 0, 0);
            docGuide.circle(bx + 1, by + 1, dollopSize + 0.5, "F");
            docGuide.restoreGraphicsState();
        }

        // Paint
        docGuide.setFillColor(item.color);
        docGuide.setDrawColor(255, 255, 255);
        docGuide.setLineWidth(0.2);
        docGuide.circle(bx, by, dollopSize, "FD");

        // Gloss
        if (GState) {
            docGuide.saveGraphicsState();
            docGuide.setGState(new GState({ opacity: 0.3 }));
            docGuide.setFillColor(255, 255, 255);
            docGuide.circle(bx - 2, by - 2, 2.5, "F");
            docGuide.restoreGraphicsState();
        }

        // Text
        docGuide.setFontSize(9);
        docGuide.setFont("helvetica", "bold");
        docGuide.setTextColor(50, 50, 50);
        docGuide.text(`${i + 1}`, lx, ly - 3, { align: "center" });

        docGuide.setFontSize(7);
        docGuide.setFont("helvetica", "normal");
        const dName = item.name.length > 12 ? item.name.substring(0, 10) + ".." : item.name;
        docGuide.text(dName, lx, ly + 1, { align: "center" });

        const amt = (unit === "ml" ? item.amount : item.amount * 0.0338).toFixed(1) + unit;
        docGuide.setTextColor(100, 100, 100);
        docGuide.text(`(${amt})`, lx, ly + 4, { align: "center" });

        // NEW: Mixing Recipe
        const recipe = getAcrylicRecipe(item.color);
        docGuide.setTextColor(79, 70, 229); // Indigo
        docGuide.setFontSize(6);
        docGuide.text(recipe, lx, ly + 8, { align: "center", maxWidth: 45 }); // Constraint width to avoid overlap
    });

    return docGuide;
}
