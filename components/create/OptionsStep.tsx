import { Settings, ArrowRight } from "lucide-react";
import Image from "next/image";
import { Area } from "react-easy-crop";
import { motion } from "framer-motion";

type OptionsStepProps = {
    croppedImage: string;
    croppedAreaPixels: Area | null;
    colors: number;
    complexity: number;
    colorOpacity: number;
    setColors: (val: number) => void;
    setComplexity: (val: number) => void;
    setColorOpacity: (val: number) => void;
    // New Detail Props
    faceDetail: number;
    bodyDetail: number;
    bgDetail: number;
    setFaceDetail: (val: number) => void;
    setBodyDetail: (val: number) => void;
    setBgDetail: (val: number) => void;
    onGenerate: () => void;
    onBack: () => void;
};

export function OptionsStep({
    croppedImage,
    croppedAreaPixels,
    colors,
    complexity,
    colorOpacity,
    setColors,
    setComplexity,
    setColorOpacity,
    faceDetail,
    bodyDetail,
    bgDetail,
    setFaceDetail,
    setBodyDetail,
    setBgDetail,
    onGenerate,
    onBack,
}: OptionsStepProps) {
    const minHours = Math.round(colors * 0.5 + complexity * 1.5);
    const maxHours = Math.round(colors * 0.7 + complexity * 2);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-12"
        >
            <div className="glass rounded-[2.5rem] p-8 md:p-10 h-fit border-slate-200 dark:border-white/5 shadow-2xl">
                <h2 className="text-2xl font-black mb-10 flex items-center gap-3 text-foreground tracking-tight">
                    <Settings className="w-6 h-6 text-indigo-400" /> Studio Parameters
                </h2>

                <div className="space-y-12">
                    <div className="group">
                        <div className="flex justify-between mb-6">
                            <label className="text-lg font-black uppercase tracking-widest text-foreground">Master Palette Range</label>
                            <span className="text-lg font-black bg-indigo-600 dark:bg-indigo-500 text-white px-6 py-2 rounded-2xl border-2 border-indigo-400/50 shadow-xl">{colors} Colors</span>
                        </div>
                        <input
                            type="range"
                            min="8"
                            max="48"
                            step="1"
                            value={colors}
                            onChange={(e) => setColors(Number(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-colors"
                        />
                        <p className="text-sm text-muted-foreground dark:text-slate-200 mt-6 font-black uppercase tracking-widest bg-slate-100 dark:bg-white/5 p-3 rounded-lg text-center border border-slate-200 dark:border-white/10">Standard kits use 24. High-fidelity studio kits use 36-48.</p>
                    </div>

                    <div className="group">
                        <div className="flex justify-between mb-6">
                            <label className="text-lg font-black uppercase tracking-widest text-foreground">Interpretation Detail</label>
                            <span className="text-lg font-black bg-indigo-600 dark:bg-indigo-500 text-white px-6 py-2 rounded-2xl border-2 border-indigo-400/50 shadow-xl">{complexity} / 10</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            value={complexity}
                            onChange={(e) => setComplexity(Number(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-colors"
                        />
                        <p className="text-sm text-muted-foreground dark:text-slate-200 mt-6 font-black uppercase tracking-widest bg-slate-100 dark:bg-white/5 p-3 rounded-lg text-center border border-slate-200 dark:border-white/10">10 = Museum grade (tiny sections). 5 = Relaxed flow.</p>
                    </div>

                    <div className="group">
                        <div className="flex justify-between mb-6">
                            <label className="text-lg font-black uppercase tracking-widest text-foreground">Canvas Ghost Tint</label>
                            <span className="text-lg font-black bg-indigo-600 dark:bg-indigo-500 text-white px-6 py-2 rounded-2xl border-2 border-indigo-400/50 shadow-xl">{colorOpacity}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="50"
                            value={colorOpacity}
                            onChange={(e) => setColorOpacity(Number(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-colors"
                        />
                        <p className="text-sm text-muted-foreground dark:text-slate-200 mt-6 font-black uppercase tracking-widest bg-slate-100 dark:bg-white/5 p-3 rounded-lg text-center border border-slate-200 dark:border-white/10">Faint color hint on physical canvas to guide your initial layers.</p>
                    </div>

                    {/* Advanced Controls */}
                    <div className="glass rounded-3xl p-6 border-slate-200 dark:border-white/5 bg-indigo-50/50 dark:bg-indigo-900/10">
                        <h3 className="font-black text-lg uppercase tracking-widest mb-6 text-indigo-500">Advanced Detail Control</h3>

                        <div className="space-y-8">
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-sm font-bold uppercase tracking-wide">Face Detail</label>
                                    <span className="text-sm font-bold text-indigo-500">{faceDetail}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={faceDetail}
                                    onChange={(e) => setFaceDetail(Number(e.target.value))}
                                    className="w-full h-1 bg-slate-300 dark:bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                                <p className="text-xs text-muted-foreground mt-2">Higher = Keeps eyes/features. Lower = Smoother skin.</p>
                            </div>

                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-sm font-bold uppercase tracking-wide">People / Body Detail</label>
                                    <span className="text-sm font-bold text-indigo-500">{bodyDetail}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={bodyDetail}
                                    onChange={(e) => setBodyDetail(Number(e.target.value))}
                                    className="w-full h-1 bg-slate-300 dark:bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                                <p className="text-xs text-muted-foreground mt-2">detail of clothes, hands, hair.</p>
                            </div>

                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-sm font-bold uppercase tracking-wide">Background Detail</label>
                                    <span className="text-sm font-bold text-indigo-500">{bgDetail}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={bgDetail}
                                    onChange={(e) => setBgDetail(Number(e.target.value))}
                                    className="w-full h-1 bg-slate-300 dark:bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-100 dark:bg-slate-900 border-2 border-indigo-500/20 dark:border-indigo-500/40 rounded-3xl p-10 relative overflow-hidden group/studio shadow-xl dark:shadow-[0_0_50px_-10px_rgba(79,70,229,0.3)]">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover/studio:opacity-30 transition-opacity">
                            <Settings className="w-24 h-24" />
                        </div>
                        <h4 className="font-black text-indigo-300 text-lg uppercase tracking-[0.3em] mb-4">Estimated Studio Session</h4>
                        <div className="text-6xl font-black text-foreground tracking-tighter">
                            {minHours} - {maxHours} <span className="text-2xl text-muted-foreground font-black uppercase tracking-widest">hours</span>
                        </div>
                        <p className="text-xl text-foreground mt-6 font-bold leading-relaxed italic">
                            {complexity > 7 || colors > 30 ? "A prestigious challenge. Our AI is generating high-density micro-regions." :
                                complexity > 4 ? "A professional balance of soul and detail. Perfect for a focused residency." :
                                    "Ideal for a relaxed studio study or beginner session."}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-10">
                <div className="glass rounded-[2.5rem] p-8 border-slate-200 dark:border-white/5 shadow-2xl relative">
                    <h3 className="font-black mb-8 text-sm text-foreground uppercase tracking-[0.4em] bg-slate-100 dark:bg-white/5 py-2 px-4 rounded-xl w-fit">Master Composition</h3>
                    <div
                        className="relative w-full bg-slate-50 dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-slate-200 dark:ring-white/10"
                        style={{ aspectRatio: croppedAreaPixels ? croppedAreaPixels.width / croppedAreaPixels.height : 1 }}
                    >
                        <Image src={croppedImage} alt="Crop preview" fill className="object-contain p-4" />
                    </div>
                </div>

                <div className="flex flex-col gap-5">
                    <button
                        onClick={onGenerate}
                        className="w-full py-6 bg-indigo-600 text-white rounded-[1.5rem] text-xl font-black hover:bg-indigo-500 shadow-[0_0_40px_-5px_rgba(79,70,229,0.4)] transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-4 group"
                    >
                        Process Studio Masterpiece
                        <ArrowRight className="w-7 h-7 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button
                        onClick={onBack}
                        className="w-full py-4 text-slate-600 dark:text-slate-200 hover:text-foreground font-black uppercase tracking-widest text-lg transition-all bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10"
                    >
                        Return to Composition
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
