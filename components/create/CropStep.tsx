import { useState } from "react";
import { Crop as CropIcon, ArrowRight, Loader2 } from "lucide-react";
import Cropper, { Point, Area } from "react-easy-crop";
import { cn } from "@/lib/utils";
import { PRINT_SIZES, PrintSize } from "@/lib/constants";
import { motion } from "framer-motion";

type CropStepProps = {
    imageUrl: string;
    crop: Point;
    zoom: number;
    aspect: number;
    isLandscape: boolean;
    printSize: PrintSize;
    customDim: { width: number; height: number };
    isUploading: boolean;
    sizeUnit: "in" | "cm";
    onCropChange: (crop: Point) => void;
    onZoomChange: (zoom: number) => void;
    onCropComplete: (croppedArea: Area, croppedAreaPixels: Area) => void;
    onOrientationChange: (landscape: boolean) => void;
    onPrintSizeSelect: (size: PrintSize) => void;
    onCustomDimChange: (field: 'width' | 'height', val: string) => void;
    onSizeUnitChange: (unit: "in" | "cm") => void;
    onBack: () => void;
    onNext: () => void;
};

export function CropStep({
    imageUrl,
    crop,
    zoom,
    aspect,
    isLandscape,
    printSize,
    customDim,
    isUploading,
    sizeUnit,
    onCropChange,
    onZoomChange,
    onCropComplete,
    onOrientationChange,
    onPrintSizeSelect,
    onCustomDimChange,
    onSizeUnitChange,
    onBack,
    onNext,
}: CropStepProps) {
    const [localPixels, setLocalPixels] = useState<Area | null>(null);

    // Helper to format size label
    const getSizeLabel = (size: PrintSize) => {
        if (size.category === "Paper") return size.name;
        if (size.name === "Custom") return "Custom";

        let w = size.width;
        let h = size.height;

        if (sizeUnit === "cm") {
            w = Math.round(w * 2.54);
            h = Math.round(h * 2.54);
        }

        return `${w}x${h}`;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-[2.5rem] p-6 md:p-10 flex flex-col min-h-[600px] lg:h-[80vh] border-slate-200 dark:border-white/5 relative overflow-hidden shadow-2xl"
        >
            <div className="mb-8 flex flex-col xl:flex-row justify-between items-start xl:items-center shrink-0 gap-6">
                <div className="flex flex-col gap-4 w-full xl:w-auto">
                    <div className="flex flex-wrap items-center gap-6">
                        <h2 className="text-2xl font-black flex items-center gap-3 text-foreground tracking-tight">
                            <CropIcon className="w-6 h-6 text-indigo-400" /> Studio Crop & Scale
                        </h2>

                        {/* Orientation Toggle */}
                        <div className="flex bg-slate-100 dark:bg-white/5 rounded-xl p-1 shadow-inner border border-slate-200 dark:border-white/5">
                            <button
                                onClick={() => onOrientationChange(false)}
                                className={cn("px-5 py-2.5 text-base font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2", !isLandscape ? "bg-indigo-600 shadow-lg text-white" : "text-slate-600 dark:text-slate-300 hover:text-foreground bg-slate-100 dark:bg-white/5")}
                            >
                                <div className="w-2.5 h-3.5 border-[1.5px] border-current rounded-[1px]" /> Port
                            </button>
                            <button
                                onClick={() => onOrientationChange(true)}
                                className={cn("px-5 py-2.5 text-base font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2", isLandscape ? "bg-indigo-600 shadow-lg text-white" : "text-slate-600 dark:text-slate-300 hover:text-foreground bg-slate-100 dark:bg-white/5")}
                            >
                                <div className="w-3.5 h-2.5 border-[1.5px] border-current rounded-[1px]" /> Land
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full overflow-hidden">
                        <div className="flex flex-nowrap gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/5 overflow-x-auto no-scrollbar max-w-full">
                            {/* Unit Toggle */}
                            <div className="flex bg-white dark:bg-white/5 rounded-lg p-0.5 mr-2 shadow-sm">
                                <button onClick={() => onSizeUnitChange("in")} className={cn("px-2 py-1 text-[10px] font-black rounded-md transition-colors", sizeUnit === "in" ? "bg-indigo-100 text-indigo-700" : "text-slate-400 hover:text-slate-600")}>IN</button>
                                <button onClick={() => onSizeUnitChange("cm")} className={cn("px-2 py-1 text-[10px] font-black rounded-md transition-colors", sizeUnit === "cm" ? "bg-indigo-100 text-indigo-700" : "text-slate-400 hover:text-slate-600")}>CM</button>
                            </div>

                            {PRINT_SIZES.map((size) => (
                                <button
                                    key={size.name}
                                    onClick={() => onPrintSizeSelect(size)}
                                    className={cn(
                                        "px-3 py-1.5 text-[10px] uppercase tracking-tighter font-bold rounded-lg transition-all flex flex-col items-center min-w-[3.5rem]",
                                        printSize.name === size.name
                                            ? "bg-indigo-600 dark:bg-white/10 shadow-lg text-white ring-1 ring-indigo-400 dark:ring-white/10"
                                            : "text-slate-600 dark:text-slate-400 hover:text-foreground hover:bg-slate-200 dark:hover:bg-white/[0.02]"
                                    )}
                                >
                                    <span>{getSizeLabel(size)}</span>
                                    <span className="text-[10px] opacity-60">{size.category}</span>
                                </button>
                            ))}
                        </div>

                        {/* Custom Inputs */}
                        {printSize.name === "Custom" && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex items-center gap-2"
                            >
                                <div className="flex items-center gap-2 bg-indigo-500/10 p-1.5 rounded-xl border border-indigo-500/20">
                                    <input
                                        type="number"
                                        value={sizeUnit === "in" ? customDim.width : Math.round(customDim.width * 2.54 * 10) / 10}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value) || 0;
                                            const inches = sizeUnit === "in" ? val : val / 2.54;
                                            onCustomDimChange('width', inches.toString());
                                        }}
                                        className="w-14 bg-transparent text-center text-sm font-black text-indigo-300 focus:outline-none"
                                        placeholder="W"
                                    />
                                    <span className="text-indigo-500/50 text-xs font-bold">×</span>
                                    <input
                                        type="number"
                                        value={sizeUnit === "in" ? customDim.height : Math.round(customDim.height * 2.54 * 10) / 10}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value) || 0;
                                            const inches = sizeUnit === "in" ? val : val / 2.54;
                                            onCustomDimChange('height', inches.toString());
                                        }}
                                        className="w-14 bg-transparent text-center text-sm font-black text-indigo-300 focus:outline-none"
                                        placeholder="H"
                                    />
                                    <span className="text-sm font-black text-indigo-400 uppercase tracking-widest pr-2">{sizeUnit}</span>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>

                <div className="flex gap-4 w-full md:w-auto xl:self-center justify-between md:justify-end">
                    <button onClick={onBack} className="px-8 py-3 text-lg font-black text-slate-500 dark:text-slate-300 hover:text-foreground bg-slate-100 dark:bg-white/5 rounded-2xl">
                        Back
                    </button>
                    <button
                        onClick={onNext}
                        disabled={isUploading}
                        className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-black hover:bg-indigo-500 flex items-center gap-3 disabled:opacity-50 shadow-xl shadow-indigo-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
                    >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Define Options <ArrowRight className="w-5 h-5" /></>}
                    </button>
                </div>
            </div>

            <div className="relative flex-1 w-full rounded-3xl overflow-hidden bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 mb-8 shadow-inner group/cropper">
                <Cropper
                    image={imageUrl}
                    crop={crop}
                    zoom={zoom}
                    aspect={aspect}
                    onCropChange={onCropChange}
                    onCropComplete={(a, p) => {
                        onCropComplete(a, p);
                        setLocalPixels(p);
                    }}
                    onZoomChange={onZoomChange}
                />

                {/* Warnings Layer */}
                <div className="absolute top-4 left-4 right-4 flex flex-col gap-2 pointer-events-none">
                    {printSize.name === "Custom" && (
                        <div className="bg-amber-500/90 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg backdrop-blur-md self-start border border-amber-400/50 animate-in fade-in slide-in-from-top-2">
                            ⚠️ Non-standard dimensions may require custom framing.
                        </div>
                    )}

                    {(() => {
                        if (!localPixels) return null;
                        const wInches = printSize.name === "Custom" ? (sizeUnit === "cm" ? customDim.width / 2.54 : customDim.width) : printSize.width;
                        const hInches = printSize.name === "Custom" ? (sizeUnit === "cm" ? customDim.height / 2.54 : customDim.height) : printSize.height;

                        const dpiW = localPixels.width / wInches;
                        const dpiH = localPixels.height / hInches;
                        const minDpi = Math.min(dpiW, dpiH);

                        if (minDpi < 100) {
                            return (
                                <div className="flex flex-col gap-2 items-start">
                                    <div className="bg-rose-500/90 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg backdrop-blur-md border border-rose-400/50 animate-in fade-in slide-in-from-top-2">
                                        🛑 Low Resolution ({Math.round(minDpi)} DPI). Print may look blurry.
                                    </div>
                                    <div className="bg-slate-800/80 text-slate-300 text-[10px] font-mono px-3 py-1 rounded-lg backdrop-blur-md">
                                        Input: {localPixels.width}x{localPixels.height}px | Target: {wInches}"x{hInches}"
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()}
                </div>
            </div>

            <div className="shrink-0 flex items-center gap-6 px-4 pb-2">
                <span className="text-lg font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-200 min-w-[100px]">Zoom</span>
                <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    onChange={(e) => onZoomChange(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-white/5 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-colors"
                />
            </div>
        </motion.div>
    );
}
