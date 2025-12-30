import { jsPDF, GState } from "jspdf";
import { loadImage, loadOptimizedImage } from "./assets";
import { getAcrylicRecipe, getShoppingList, getStandardHex, getInventoryRequirements } from "../colors/mixing"; // Import Mixing Logic

interface GuideOptions {
    originalUrl?: string; // Optional path to original Uploaded image
    posterizedUrl: string; // The "Painted Result"
    outlineUrl: string; // The "Canvas Lines"
    palette: { color: string; name: string; amount: number; percentage: number }[];
    unit?: "ml" | "oz";
    opacity: number;
    labels: { x: number; y: number; index: number; fontSize?: number }[];
    pixelDimension: { width: number; height: number };
    physicalDimension: { width: number; height: number };
}

export async function generateGuidePDF(options: GuideOptions): Promise<jsPDF> {
    const { originalUrl, posterizedUrl, outlineUrl, palette, unit = "ml", opacity, labels, pixelDimension, physicalDimension } = options;

    const docGuide = new jsPDF({
        unit: "mm",
        format: "letter",
        orientation: "portrait"
    });

    // --- RECALCULATE VOLUMES DYNAMICALLY ---
    // User might have requested a different size than processed.
    // We trust 'physicalDimension' (Inches) and 'percentage' to be the truth.
    const areaSqIn = physicalDimension.width * physicalDimension.height;
    const areaCm2 = areaSqIn * 6.4516;
    const COVERAGE_CM2_PER_ML = 10; // Conservative
    const SAFETY_FACTOR = 2.5;

    palette.forEach(p => {
        const itemAreaCm2 = areaCm2 * (p.percentage / 100);
        let estimatedMl = (itemAreaCm2 / COVERAGE_CM2_PER_ML) * SAFETY_FACTOR;
        p.amount = Math.max(0.5, estimatedMl);
    });
    // ---------------------------------------

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

    // PAGE 1: Intro & Checklist (Portrait)
    const guideW = docGuide.internal.pageSize.getWidth();
    addGuideBranding(docGuide, false);

    // Title Section
    docGuide.setFontSize(28); // Slightly friendlier size
    docGuide.setTextColor(20, 20, 20);
    docGuide.setFont("helvetica", "bold");
    docGuide.text("Let's Paint Some Memories!", guideW / 2, 50, { align: "center" });

    docGuide.setFontSize(10);
    docGuide.setTextColor(99, 102, 241); // Indigo 400
    docGuide.text("YOUR CUSTOM PAINTING KIT", guideW / 2, 58, { align: "center", charSpace: 2 });

    docGuide.setDrawColor(200, 200, 200);
    docGuide.setLineWidth(0.1);
    docGuide.line(40, 65, guideW - 40, 65);

    // Fun Checklist
    docGuide.setFontSize(14);
    docGuide.setTextColor(50, 50, 50);
    docGuide.setFont("helvetica", "bold");
    docGuide.text("The Game Plan", 20, 85);

    const instructions = [
        { head: "1. SET THE ATMOSPHERE", desc: "Painting requires a vibe. Good lighting is non-negotiable. A beverage is highly recommended. Put on a podcast or playlist." },
        { head: "2. CHOOSE YOUR METHOD", desc: "OPTION A (EASY): Print the 'Canvas-Ref' PDF on cardstock and just paint it.\nOPTION B (THE CRAFTY PRO WAY): Download the 'Reverse' PDF. Use Gloss Gel Medium to transfer the ink directly onto a real canvas. It looks incredible. Google 'Gel Transfer Method'—it's worth it." },
        { head: "3. MIX WITH CONFIDENCE", desc: "Use the palette chart on the last page. Don't worry about being exact. Close enough is usually perfect. Channel your inner Bob Ross." },
        { head: "4. THE 5-FOOT RULE", desc: "Paint-by-numbers looks jagged close up. Step back 5 feet and squint. The magic happens at a distance. Don't stress the tiny details." },
        { head: "5. MAKE IT YOURS", desc: "If you go outside the lines or change a color, tell people it was an 'artistic choice'. No one will know." }
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

    // PAGE 2: Original Photo
    if (originalUrl) {
        let originalImg;
        try {
            originalImg = await loadOptimizedImage(originalUrl, 1200, "jpeg");
        } catch (e) { console.warn("Could not load original image", e); }

        if (originalImg) {
            const props = docGuide.getImageProperties(originalImg);
            const isLandscape = props.width > props.height;
            docGuide.addPage("letter", isLandscape ? "landscape" : "portrait");
            addGuideBranding(docGuide, isLandscape);

            const pW = docGuide.internal.pageSize.getWidth();
            const pH = docGuide.internal.pageSize.getHeight();

            docGuide.setFontSize(12);
            docGuide.setTextColor(100, 100, 100);
            docGuide.text("Reference: The Original Moment", 15, 25);

            const availW = pW - 30;
            const availH = pH - 40;
            const imgAspect = props.width / props.height;
            let drawW = availW;
            let drawH = availW / imgAspect;
            if (drawH > availH) {
                drawH = availH;
                drawW = drawH * imgAspect;
            }
            docGuide.addImage(originalImg, "JPEG", (pW - drawW) / 2, 30, drawW, drawH);
        }
    }

    // PAGE 3: Painted Result (Color Reference)
    try {
        const resultImg = await loadOptimizedImage(posterizedUrl, 1200, "jpeg");
        const props = docGuide.getImageProperties(resultImg);
        const isLandscape = props.width > props.height;

        docGuide.addPage("letter", isLandscape ? "landscape" : "portrait");
        addGuideBranding(docGuide, isLandscape);

        docGuide.setFontSize(12);
        docGuide.setTextColor(100, 100, 100);
        docGuide.text("Reference: The Painted Look", 15, 25);

        const pW = docGuide.internal.pageSize.getWidth();
        const pH = docGuide.internal.pageSize.getHeight();
        const availW = pW - 30;
        const availH = pH - 40;
        const imgAspect = props.width / props.height;
        let drawW = availW;
        let drawH = availW / imgAspect;
        if (drawH > availH) {
            drawH = availH;
            drawW = drawH * imgAspect;
        }

        // OPACITY FIX: Apply user opacity to match Canvas
        const finalOpacity = opacity > 0 ? opacity / 100 : 1.0;
        docGuide.saveGraphicsState();
        docGuide.setGState(new GState({ opacity: finalOpacity }));
        docGuide.addImage(resultImg, "JPEG", (pW - drawW) / 2, 30, drawW, drawH);
        docGuide.restoreGraphicsState();
    } catch (e) { console.warn(e); }

    // PAGE 4: Canvas Outline (New)
    try {
        const outlineImg = await loadOptimizedImage(outlineUrl, 1200, "png"); // Use PNG to preserve line sharpness/transparency
        const props = docGuide.getImageProperties(outlineImg);
        const isLandscape = props.width > props.height;

        docGuide.addPage("letter", isLandscape ? "landscape" : "portrait");
        addGuideBranding(docGuide, isLandscape);

        docGuide.setFontSize(12);
        docGuide.setTextColor(100, 100, 100);
        docGuide.text("Reference: Canvas Lines", 15, 25);

        const pW = docGuide.internal.pageSize.getWidth();
        const pH = docGuide.internal.pageSize.getHeight();
        const availW = pW - 30;
        const availH = pH - 40;
        const imgAspect = props.width / props.height;
        let drawW = availW;
        let drawH = availW / imgAspect;
        if (drawH > availH) {
            drawH = availH;
            drawW = drawH * imgAspect;
        }

        // COMPOSITE: Draw Faded Color Background First (if opacity > 0)
        // This matches the actual Canvas PDF appearance
        if (opacity > 0) {
            try {
                // Reuse the resultImg from Page 3 if possible, or reload
                // We'll just reload/cache-hit it here for safety
                const bgImg = await loadOptimizedImage(posterizedUrl, 1200, "jpeg");
                const finalOpacity = opacity / 100;

                docGuide.saveGraphicsState();
                docGuide.setGState(new GState({ opacity: finalOpacity }));
                docGuide.addImage(bgImg, "JPEG", (pW - drawW) / 2, 30, drawW, drawH);
                docGuide.restoreGraphicsState();
            } catch (e) {
                console.warn("Could not load background for Page 4 composite", e);
            }
        }

        // Draw Lines on top
        docGuide.addImage(outlineImg, "PNG", (pW - drawW) / 2, 30, drawW, drawH);

        // --- DRAW LABELS ---
        const startX = (pW - drawW) / 2;
        const startY = 30;
        // Scale labels from Image Pixels to PDF MM
        const scaleX = drawW / pixelDimension.width;
        const scaleY = drawH / pixelDimension.height;

        docGuide.setFont("helvetica", "bold");
        docGuide.setTextColor(100, 130, 160); // Slate Blue

        // Filter labels slightly if they are too small? No, user wants them.
        labels.forEach(label => {
            const lx = startX + (label.x * scaleX);
            const ly = startY + (label.y * scaleY);
            // Limit font size range
            const ptSize = Math.max(4, Math.min(12, (label.fontSize || 0.5) * 10)); // Slightly smaller scale than canvas

            docGuide.setFontSize(ptSize);
            docGuide.text(`${label.index}`, lx, ly, { align: "center", baseline: "middle" });
        });

    } catch (e) { console.warn(e); }


    // PAGE 5: Palette Legend (The New Layout)
    docGuide.addPage("letter", "landscape");
    // No branding on header to save space? Or Keep it? keep it minimal.
    // addGuideBranding(docGuide, true); // Let's skip top branding to maximize top space for the palette

    const palW = docGuide.internal.pageSize.getWidth();
    const palH = docGuide.internal.pageSize.getHeight();

    // 1. Background Palette Image (Full Page / Maximized)
    try {
        const paletteBase = await loadImage("/palette_base.png");
        // Maintain Aspect Ratio, fit Width
        const palBaseAspect = 1.4; // rough guess
        let pImgW = palW;
        let pImgH = pImgW / palBaseAspect;

        // If height is too tall, constrain by height
        if (pImgH > palH) {
            pImgH = palH;
            pImgW = pImgH * palBaseAspect;
        }

        // Center it
        const px = (palW - pImgW) / 2;
        const py = (palH - pImgH) / 2;

        docGuide.addImage(paletteBase, "PNG", px, py, pImgW, pImgH);
    } catch (e) { console.warn(e) }

    // Title Overlay (Centered)
    docGuide.setFontSize(24);
    docGuide.setTextColor(40, 40, 40);
    docGuide.setFont("helvetica", "bold");
    docGuide.text("Studio Palette", palW / 2, 20, { align: "center" });

    docGuide.setFontSize(9);
    docGuide.setTextColor(80, 80, 80);
    docGuide.setFont("helvetica", "normal");
    docGuide.text(`Mixing Guide for ${palette.length} Colors`, palW / 2, 26, { align: "center" });


    // 2. The 4-Column Grid
    const margin = 10;
    const numCols = 4;
    const colGap = 4;
    const availableW = palW - (2 * margin);
    const colWidth = (availableW - ((numCols - 1) * colGap)) / numCols;

    const startY = 35;
    const endY = palH - 10;
    const availableH = endY - startY;

    // Calculate Rows needed
    const numRows = Math.ceil(palette.length / numCols);

    // Dynamic Row Height: Fill the space!
    // If 24 colors -> 6 rows. 170mm / 6 = 28mm height (Huge!). 
    // If 40 colors -> 10 rows. 170mm / 10 = 17mm height (Good).
    const calculatedRowH = availableH / numRows;
    const rowH = Math.min(35, Math.max(14, calculatedRowH));

    // Dynamic Fonts & Swatch
    const swatchSize = rowH * 0.7; // Large swatches (70% of height)
    const nameSize = Math.min(10, rowH * 0.25); // Limit font size so it doesn't look cartoonish
    const recipeSize = Math.min(7, rowH * 0.2);

    palette.forEach((item, i) => {
        const col = i % numCols;
        const row = Math.floor(i / numCols);

        const x = margin + (col * (colWidth + colGap));
        const y = startY + (row * rowH);

        // Center content vertically in the row
        const centerY = y + (rowH / 2);

        // Swatch (Left)
        docGuide.setFillColor(item.color);
        docGuide.setDrawColor(200, 200, 200);
        docGuide.setLineWidth(0.1);
        docGuide.rect(x, centerY - (swatchSize / 2), swatchSize, swatchSize, "FD");

        // Text (Right of Swatch)
        const tx = x + swatchSize + 3;
        const maxTextW = colWidth - swatchSize - 3;

        // ID & Name (Top Line)
        docGuide.setFontSize(nameSize);
        docGuide.setFont("helvetica", "bold");
        docGuide.setTextColor(20, 20, 20);
        docGuide.text(`${i + 1}. ${item.name}`, tx, centerY - (rowH * 0.15), { maxWidth: maxTextW });

        // Recipe (Bottom Line)
        const recipe = getAcrylicRecipe(item.color);
        docGuide.setFontSize(recipeSize);
        docGuide.setFont("helvetica", "normal");
        docGuide.setTextColor(80, 80, 80);
        // Clean up recipe
        const cleanRecipe = recipe
            .replace("Use standard", "Standard")
            .replace("Mix", "Mix:")
            .replace(/\[/g, "")
            .replace(/\]/g, "");
        docGuide.text(cleanRecipe, tx, centerY + (rowH * 0.25) + 1, { maxWidth: maxTextW, lineHeightFactor: 1.1 });
    });

    // PAGE 6: Shopping List
    docGuide.addPage("letter", "portrait");
    addGuideBranding(docGuide, false);

    // Header
    const shopW = docGuide.internal.pageSize.getWidth();
    docGuide.setFontSize(22);
    docGuide.setTextColor(20, 20, 20);
    docGuide.setFont("helvetica", "bold");
    docGuide.text("Studio Inventory Checklist", shopW / 2, 40, { align: "center" });

    docGuide.setFontSize(10);
    docGuide.setTextColor(100, 100, 100);
    docGuide.setFont("helvetica", "normal");
    docGuide.text("Everything you need to complete your masterpiece.", shopW / 2, 48, { align: "center" });

    // SECTION 1: Base Paints (Swatches + Volumes)
    // 1. Calculate Aggregated Volumes
    // import { getInventoryRequirements } from "../colors/mixing"; // REMOVED
    const inventory = getInventoryRequirements(palette);
    const requiredPaints = Object.keys(inventory).sort();

    let shopY = 65;

    docGuide.setFontSize(14);
    docGuide.setTextColor(50, 50, 50);
    docGuide.setFont("helvetica", "bold");
    docGuide.text("1. Base Acrylic Paints", 20, shopY);

    docGuide.line(20, shopY + 3, shopW - 20, shopY + 3);
    shopY += 15;

    // 3-Column Grid for Paints
    const paintCols = 3;
    const PaintColW = (shopW - 40) / paintCols;
    const paintRowH = 12;

    requiredPaints.forEach((paint, i) => {
        const col = i % paintCols;
        const row = Math.floor(i / paintCols);

        const px = 20 + (col * PaintColW);
        const py = shopY + (row * paintRowH);

        // Checkbox
        docGuide.setDrawColor(150, 150, 150);
        docGuide.setLineWidth(0.1);
        docGuide.setFillColor(255, 255, 255);
        docGuide.rect(px, py, 5, 5);

        // Swatch
        const hex = getStandardHex(paint);
        docGuide.setFillColor(hex);
        docGuide.setDrawColor(200, 200, 200);
        docGuide.circle(px + 12, py + 2.5, 3, "FD");

        // Name
        docGuide.setFontSize(10);
        docGuide.setTextColor(40, 40, 40);
        docGuide.setFont("helvetica", "bold");
        docGuide.text(`${paint}`, px + 19, py + 2.5);

        // Volume (New Line)
        const vol = Math.ceil(inventory[paint]); // Round up to nearest ml
        const displayUnit = unit === "ml" ? "ml" : "oz";
        const dispVol = unit === "ml" ? vol : Math.ceil(vol * 0.0338 * 10) / 10; // 1 decimal for oz

        docGuide.setFontSize(8);
        docGuide.setTextColor(100, 100, 100);
        docGuide.setFont("helvetica", "normal");
        docGuide.text(`${dispVol}${displayUnit} estimated`, px + 19, py + 6.5);
    });

    shopY += (Math.ceil(requiredPaints.length / paintCols) * paintRowH) + 20;

    // SECTION 2: Essentials
    docGuide.setFontSize(14);
    docGuide.setTextColor(50, 50, 50);
    docGuide.setFont("helvetica", "bold");
    docGuide.text("2. Studio Essentials", 20, shopY);
    docGuide.line(20, shopY + 3, shopW - 20, shopY + 3);
    shopY += 15;

    const essentials = [
        "Detail Brush (Size 0 or 00) for tiny areas",
        "Round Brush (Size 4) for general coverage",
        "Flat Brush (Size 8) for large backgrounds",
        "Palette Knife (for mixing colors cleanly)",
        "Water Cup & Paper Towels",
        "Palette Paper or a white ceramic plate"
    ];

    essentials.forEach((item) => {
        docGuide.setDrawColor(150, 150, 150);
        docGuide.setFillColor(255, 255, 255);
        docGuide.rect(20, shopY, 5, 5); // Checkbox

        docGuide.setFontSize(10);
        docGuide.setTextColor(60, 60, 60);
        docGuide.setFont("helvetica", "normal");
        docGuide.text(item, 30, shopY + 3.5);

        shopY += 10;
    });

    // Footer note
    shopY += 15;
    docGuide.setFontSize(9);
    docGuide.setTextColor(100, 100, 100);
    docGuide.setFont("helvetica", "italic");
    docGuide.text("Note: Standard 'Student Grade' acrylics (Liquitex Basics, Golden) are perfect for this project.", shopW / 2, shopY, { align: "center" });

    // Extra Note
    shopY += 5;
    docGuide.setTextColor(244, 63, 94); // Rose 500
    docGuide.text("Tip: These volume estimates are just that—estimates. Buy 20-30% extra to be safe!", shopW / 2, shopY, { align: "center" });


    return docGuide;
}
