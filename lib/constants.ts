import { Sparkles, Image as ImageIcon, MousePointer2, Palette as PaletteIcon, RefreshCw } from "lucide-react";
import React from "react";

export interface PrintSize {
    name: string;
    width: number;
    height: number;
    category: string;
}

export const PRINT_SIZES: PrintSize[] = [
    { name: "Letter", width: 8.5, height: 11, category: "Paper" },
    { name: "Tabloid", width: 11, height: 17, category: "Paper" },
    { name: "12x12", width: 12, height: 12, category: "Square" },
    { name: "16x20", width: 16, height: 20, category: "Canvas" },
    { name: "18x24", width: 18, height: 24, category: "Canvas" },
    { name: "20x20", width: 20, height: 20, category: "Square" },
    { name: "24x36", width: 24, height: 36, category: "Canvas" },
    { name: "30x40", width: 30, height: 40, category: "Canvas" },
    { name: "Custom", width: 0, height: 0, category: "Custom" },
];

export const LOADING_STEPS = [
    { label: "Isolating Color DNA...", icon: React.createElement(Sparkles, { className: "w-4 h-4" }) },
    { label: "Mapping Artistic Regions...", icon: React.createElement(ImageIcon, { className: "w-4 h-4" }) },
    { label: "Tracing Studio Outlines...", icon: React.createElement(MousePointer2, { className: "w-4 h-4" }) },
    { label: "Formulating Pigment Volumes...", icon: React.createElement(PaletteIcon, { className: "w-4 h-4" }) },
    { label: "Polishing Digital Canvas...", icon: React.createElement(RefreshCw, { className: "w-4 h-4" }) },
];

export const PRO_TIPS = [
    "High Resolution (Edges stay sharp)",
    "Good Lighting (Avoid dark shadows)",
    "Distinct Features (Faces clearly visible)",
    "Balanced Contrast (Not too washed out)",
];
