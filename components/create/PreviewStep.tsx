import { motion } from "framer-motion";
import { Eye, Check, RefreshCw, FileDown, BookOpen } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Area } from "react-easy-crop";

type PreviewStepProps = {
    resultImage: string | null;
    outlineImage: string | null;
    palette: any[];
    opacity: number;
    unit: "ml" | "oz";
    croppedAreaPixels: Area | null;
    setOpacity: (val: number) => void;
    setUnit: (val: "ml" | "oz") => void;
    downloadingType: "canvas" | "guide" | "canvas-reverse" | null;
    onDownload: (type: "canvas" | "guide" | "canvas-reverse") => void; // Updated Signature
    onReset: () => void;
};

export function PreviewStep({
    resultImage,
    outlineImage,
    palette,
    opacity,
    unit,
    croppedAreaPixels,
    setOpacity,
    setUnit,
    downloadingType,
    onDownload,
    onReset,
}: PreviewStepProps) {
    if (!resultImage) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-12"
        >
            {/* Left Column: The Workspace (Outline and Opacity) */}
            <div className="lg:col-span-8 space-y-10">
                <div className="glass rounded-[2.5rem] p-6 md:p-10 shadow-2xl border-slate-200 dark:border-white/5 relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
                        <h3 className="font-black text-2xl tracking-tighter text-foreground">Interactive Studio Worksheet</h3>
                        <div className="flex items-center gap-4 bg-slate-100 dark:bg-white/5 px-5 py-3 rounded-2xl border border-slate-200 dark:border-white/10 shadow-inner w-full sm:w-auto backdrop-blur-md">
                            <span className="text-sm font-black text-muted-foreground dark:text-slate-200 flex items-center gap-2 uppercase tracking-[0.2em] shrink-0 bg-slate-100 dark:bg-white/5 py-1 px-3 rounded-lg">
                                <Eye className="w-4 h-4 text-indigo-500 dark:text-indigo-400" /> Vision Tint
                            </span>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={opacity}
                                onChange={(e) => setOpacity(Number(e.target.value))}
                                className="w-full sm:w-32 h-1.5 accent-indigo-500 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    </div>

                    <div
                        className="relative w-full bg-slate-50 dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-2xl group ring-1 ring-slate-200 dark:ring-white/5"
                        style={{ aspectRatio: croppedAreaPixels ? croppedAreaPixels.width / croppedAreaPixels.height : 1 }}
                    >
                        {/* Bottom Layer: Color Image (Faded) */}
                        <div style={{ opacity: opacity / 100 }} className="absolute inset-0 z-0 transition-opacity duration-300">
                            <img src={resultImage} alt="Color Guide" className="object-contain w-full h-full" />
                        </div>
                        {/* Top Layer: Outline (Always visible) */}
                        {outlineImage && (
                            <div className="absolute inset-0 z-10 mix-blend-multiply opacity-90 pointer-events-none">
                                <img src={outlineImage} alt="Outline" className="object-contain w-full h-full" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="glass rounded-[2.5rem] p-6 md:p-10 shadow-2xl border-slate-200 dark:border-white/5">
                    <h3 className="font-black mb-10 text-2xl tracking-tighter text-foreground">Final Studio Masterpiece</h3>
                    <div
                        className="relative w-full bg-slate-50 dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-2xl ring-1 ring-slate-200 dark:ring-white/5"
                        style={{ aspectRatio: croppedAreaPixels ? croppedAreaPixels.width / croppedAreaPixels.height : 1 }}
                    >
                        <img src={resultImage} alt="Reference" className="object-contain w-full h-full" />
                    </div>
                </div>
            </div>

            {/* Right Column: Palette and Actions */}
            <div className="lg:col-span-4 space-y-10 lg:sticky lg:top-8 h-fit">
                <div className="glass rounded-[2.5rem] p-8 shadow-2xl border-slate-200 dark:border-white/5 flex flex-col max-h-[75vh]">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="font-black text-2xl tracking-tighter text-foreground">Studio Palette</h3>
                        <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/10">
                            <button
                                onClick={() => setUnit("ml")}
                                className={cn("text-sm uppercase font-black px-5 py-2.5 rounded-xl transition-all", unit === "ml" ? "bg-indigo-600 shadow-lg text-white" : "text-slate-600 dark:text-slate-300 hover:text-foreground bg-slate-100 dark:bg-white/5")}
                            >ml</button>
                            <button
                                onClick={() => setUnit("oz")}
                                className={cn("text-sm uppercase font-black px-5 py-2.5 rounded-xl transition-all", unit === "oz" ? "bg-indigo-600 shadow-lg text-white" : "text-slate-600 dark:text-slate-300 hover:text-foreground bg-slate-100 dark:bg-white/5")}
                            >oz</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 overflow-y-auto pr-3 custom-scrollbar flex-1 -mr-2">
                        {palette.map((item, i) => (
                            <div key={i} className="flex items-center gap-5 p-4 rounded-2xl hover:bg-white/[0.04] transition-all border border-transparent hover:border-white/5 group bg-white/[0.01]">
                                <div className="flex flex-col items-center gap-1.5 shrink-0">
                                    <div className="w-12 h-12 rounded-full border-2 border-slate-200 dark:border-slate-900 shadow-2xl ring-2 ring-slate-100 dark:ring-white/5 transition-transform group-hover:scale-110 group-hover:ring-indigo-500/50" style={{ backgroundColor: item.color }} />
                                    <span className="text-sm font-black text-muted-foreground dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 uppercase tracking-widest bg-slate-100 dark:bg-white/5 px-2 rounded-lg">#{i + 1}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-black text-xl truncate text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-100 transition-colors tracking-tight">{item.name}</div>
                                    <div className="text-sm font-mono text-muted-foreground dark:text-slate-200 font-bold uppercase tracking-widest bg-slate-100 dark:bg-white/5 w-fit px-2 rounded-md mt-1">{item.color}</div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="font-mono font-black text-sm text-indigo-300/90 tracking-tighter">
                                        {unit === "ml" ? `${Math.round(item.amount)}ml` : `${(item.amount * 0.0338).toFixed(1)}oz`}
                                    </div>
                                    <div className="text-xs text-muted-foreground dark:text-slate-300 font-black uppercase tracking-widest">
                                        {item.percentage < 1 ? item.percentage.toFixed(1) : Math.round(item.percentage)}% area
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden group/kit">
                    <h3 className="text-indigo-700 dark:text-indigo-100 font-black mb-6 flex items-center gap-4 uppercase tracking-[0.3em] text-base bg-indigo-50 dark:bg-indigo-900/50 py-3 px-6 rounded-2xl w-fit border border-indigo-200 dark:border-indigo-400/30 shadow-xl">
                        <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400" /> Downloads
                    </h3>

                    <div className="grid grid-cols-1 gap-4">
                        <button
                            onClick={() => onDownload("canvas")}
                            disabled={!!downloadingType}
                            title="For Printing to Canvas"
                            className={cn(
                                "w-full py-4 rounded-2xl font-black transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 text-lg relative overflow-hidden",
                                downloadingType === "canvas" ? "bg-slate-400 cursor-not-allowed text-slate-200" : (downloadingType ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-emerald-600 text-white hover:bg-emerald-500")
                            )}
                        >
                            {downloadingType === "canvas" ? <RefreshCw className="w-6 h-6 animate-spin" /> : <FileDown className="w-6 h-6" />}
                            {downloadingType === "canvas" ? "Generating..." : "Download Canvas"}
                        </button>

                        <button
                            onClick={() => onDownload("canvas-reverse" as any)}
                            disabled={!!downloadingType}
                            title="For Craft Transfer to Canvas"
                            className={cn(
                                "w-full py-4 rounded-2xl font-black transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 text-lg relative overflow-hidden",
                                downloadingType === "canvas-reverse" ? "bg-slate-400 cursor-not-allowed text-slate-200" : (downloadingType ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-purple-600 text-white hover:bg-purple-500")
                            )}
                        >
                            {downloadingType === "canvas-reverse" ? <RefreshCw className="w-6 h-6 animate-spin" /> : <FileDown className="w-6 h-6 transform scale-x-[-1]" />}
                            {downloadingType === "canvas-reverse" ? "Generating..." : "Download Reverse"}
                        </button>

                        <button
                            onClick={() => onDownload("guide")}
                            disabled={!!downloadingType}
                            className={cn(
                                "w-full py-4 rounded-2xl font-black transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 text-lg",
                                downloadingType === "guide" ? "bg-slate-400 cursor-not-allowed text-slate-200" : (downloadingType ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-500")
                            )}
                        >
                            {downloadingType === "guide" ? <RefreshCw className="w-6 h-6 animate-spin" /> : <BookOpen className="w-6 h-6" />}
                            {downloadingType === "guide" ? "Generating..." : "Download Guide"}
                        </button>
                    </div>
                </div>

                <button
                    onClick={onReset}
                    className="w-full py-4 text-slate-600 dark:text-slate-300 hover:text-foreground font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-4 border-2 border-slate-200 dark:border-white/10 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 bg-slate-50 dark:bg-black/20"
                >
                    <RefreshCw className="w-5 h-5" /> Reset Studio Parameters
                </button>
            </div>
        </motion.div>
    );
}
