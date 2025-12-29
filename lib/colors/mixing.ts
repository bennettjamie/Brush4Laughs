
// Standard 24-Color Acrylic Set (Liquitex/Golden Basics Approx)
const STANDARD_ACRYLIC_24 = [
    { name: "Titanium White", hex: "#F6F9FA" },
    { name: "Lamp Black", hex: "#2C2C2C" }, // Not pure black usually
    { name: "Burnt Umber", hex: "#8A3324" },
    { name: "Raw Umber", hex: "#826644" },
    { name: "Burnt Sienna", hex: "#E97451" },
    { name: "Raw Sienna", hex: "#C76114" },
    { name: "Yellow Ochre", hex: "#CC7722" },
    { name: "Cadmium Red Deep", hex: "#E30022" },
    { name: "Cadmium Red Medium", hex: "#ED1C24" }, // Bright red
    { name: "Vermilion", hex: "#E34234" },
    { name: "Crimson Alizarin", hex: "#E32636" },
    { name: "Cadmium Orange", hex: "#F28C28" },
    { name: "Cadmium Yellow Deep", hex: "#FFCC00" },
    { name: "Cadmium Yellow Medium", hex: "#FFF600" }, // Primary Yellow
    { name: "Lemon Yellow", hex: "#FFF44F" }, // Cool Yellow
    { name: "Sap Green", hex: "#507D2A" },
    { name: "Hooker's Green", hex: "#49796B" },
    { name: "Phthalo Green", hex: "#123524" },
    { name: "Viridian", hex: "#40826D" },
    { name: "Ultramarine Blue", hex: "#4166F5" },
    { name: "Cobalt Blue", hex: "#0047AB" },
    { name: "Phthalo Blue", hex: "#000F89" },
    { name: "Cerulean Blue", hex: "#2A52BE" },
    { name: "Dioxazine Purple", hex: "#8F00FF" },
];

// Helper: Hex to RGB
function hexToRgb(hex: string): [number, number, number] {
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    return [r, g, b];
}

// Helper: Color Distance (Euclidean)
function colorDist(c1: [number, number, number], c2: [number, number, number]) {
    return Math.sqrt((c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2 + (c1[2] - c2[2]) ** 2);
}

// Helper: Mix 2 colors
function mix(c1: [number, number, number], c2: [number, number, number], ratio: number): [number, number, number] {
    // ratio is 0 to 1 (portion of c1)
    const r = c1[0] * ratio + c2[0] * (1 - ratio);
    const g = c1[1] * ratio + c2[1] * (1 - ratio);
    const b = c1[2] * ratio + c2[2] * (1 - ratio);
    return [r, g, b];
}

export function getAcrylicRecipe(targetHex: string): string {
    const targetRGB = hexToRgb(targetHex);

    // 1. Check for Exact/Close Match (Single Tube)
    let bestSingleDist = Infinity;
    let bestSingleName = "";

    for (const p of STANDARD_ACRYLIC_24) {
        const d = colorDist(targetRGB, hexToRgb(p.hex));
        if (d < bestSingleDist) {
            bestSingleDist = d;
            bestSingleName = p.name;
        }
    }

    if (bestSingleDist < 15) {
        return `Use standard [${bestSingleName}]`;
    }

    // 2. Check for 2-Color Mix (Simple Ratios: 1:1, 2:1, 3:1, 4:1)
    // We only check mixing with: White, Black, or Neighbors?
    // Brute force is okay for 24 colors * 24 colors * 4 ratios = ~2300 checks (negligible)

    let bestMixDist = bestSingleDist;
    let bestMixStr = `Use standard [${bestSingleName}] (Closest)`;

    const ratios = [0.5, 0.66, 0.75, 0.8]; // 1:1, 2:1, 3:1, 4:1
    const ratioNames = ["1:1", "2:1", "3:1", "4:1"];

    for (let i = 0; i < STANDARD_ACRYLIC_24.length; i++) {
        for (let j = i + 1; j < STANDARD_ACRYLIC_24.length; j++) {
            const c1 = STANDARD_ACRYLIC_24[i];
            const c2 = STANDARD_ACRYLIC_24[j];
            const rgb1 = hexToRgb(c1.hex);
            const rgb2 = hexToRgb(c2.hex);

            for (let r = 0; r < ratios.length; r++) {
                // Try c1 dominant
                const mix1 = mix(rgb1, rgb2, ratios[r]);
                const d1 = colorDist(targetRGB, mix1);
                if (d1 < bestMixDist) {
                    bestMixDist = d1;
                    bestMixStr = `Mix [${c1.name}] & [${c2.name}] (${ratioNames[r]})`;
                }

                // Try c2 dominant (skip 1:1 since it's symmetric)
                if (ratios[r] !== 0.5) {
                    const mix2 = mix(rgb2, rgb1, ratios[r]);
                    const d2 = colorDist(targetRGB, mix2);
                    if (d2 < bestMixDist) {
                        bestMixDist = d2;
                        bestMixStr = `Mix [${c2.name}] & [${c1.name}] (${ratioNames[r]})`;
                    }
                }
            }
        }
    }

    return bestMixStr;
}

export function getShoppingList(paletteHexes: string[]): string[] {
    const needed = new Set<string>();

    for (const hex of paletteHexes) {
        const recipe = getAcrylicRecipe(hex);
        // Robust Parsing: Use brackets to handle names with apostrophes (e.g. "Hooker's Green")
        if (recipe.includes("Use standard")) {
            const match = recipe.match(/\[([^\]]+)\]/);
            if (match) needed.add(match[1]);
        } else if (recipe.includes("Mix")) {
            const matches = recipe.matchAll(/\[([^\]]+)\]/g);
            for (const m of matches) {
                needed.add(m[1]);
            }
        }
    }

    return Array.from(needed).sort();
}

/**
 * Calculates the total volume needed for each base paint tube, 
 * aggregating amounts from all mixed colors in the palette.
 */
export function getInventoryRequirements(palette: { color: string, amount: number }[]): Record<string, number> {
    const totals: Record<string, number> = {};

    const addToTotal = (name: string, amt: number) => {
        totals[name] = (totals[name] || 0) + amt;
    };

    // Ratios corresponding to mixing.ts generation logic
    // "1:1" -> [0.5, 0.5]
    // "2:1" -> [0.67, 0.33]
    // "3:1" -> [0.75, 0.25]
    // "4:1" -> [0.8, 0.2]
    const ratioMap: Record<string, number> = {
        "1:1": 0.5,
        "2:1": 0.666,
        "3:1": 0.75,
        "4:1": 0.8
    };

    for (const p of palette) {
        const recipe = getAcrylicRecipe(p.color);

        if (recipe.includes("Use standard")) {
            const match = recipe.match(/\[([^\]]+)\]/);
            if (match) {
                addToTotal(match[1], p.amount);
            }
        } else if (recipe.includes("Mix")) {
            // Format: "Mix [Color1] & [Color2] (Ratio)"
            // Example: "Mix [Phthalo Green] & [Lamp Black] (4:1)"
            const matches = [...recipe.matchAll(/\[([^\]]+)\]/g)];
            const ratioMatch = recipe.match(/\(([^)]+)\)/); // Finds "(4:1)"

            if (matches.length >= 2 && ratioMatch) {
                const c1 = matches[0][1];
                const c2 = matches[1][1];
                const ratioStr = ratioMatch[1];

                const primaryFraction = ratioMap[ratioStr] || 0.5;
                const secondaryFraction = 1.0 - primaryFraction;

                addToTotal(c1, p.amount * primaryFraction);
                addToTotal(c2, p.amount * secondaryFraction);
            }
        }
    }

    return totals;
}

export function getStandardHex(name: string): string {
    const found = STANDARD_ACRYLIC_24.find(p => p.name === name);
    return found ? found.hex : "#CCCCCC"; // Default gray if not found
}
