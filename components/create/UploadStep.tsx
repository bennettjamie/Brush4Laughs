import { Upload, Loader2, Check, Camera, Shield } from "lucide-react";
import { PRO_TIPS } from "@/lib/constants";

type UploadStepProps = {
    isUploading: boolean;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export function UploadStep({ isUploading, onFileChange }: UploadStepProps) {
    return (
        <>
            <div className="glass border-dashed border-slate-300 dark:border-white/10 p-16 text-center transition-all hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-white/[0.04] rounded-[2rem] group/box">
                <input
                    type="file"
                    id="upload"
                    className="hidden"
                    accept="image/*"
                    onChange={onFileChange}
                    disabled={isUploading}
                />

                {/* Secondary Input for Direct Camera Access */}
                <input
                    type="file"
                    id="camera-upload"
                    className="hidden"
                    accept="image/*"
                    capture="environment" // Forces rear camera on mobile
                    onChange={onFileChange}
                    disabled={isUploading}
                />

                <label
                    htmlFor="upload"
                    className="flex flex-col items-center cursor-pointer group"
                >
                    <div className="relative w-28 h-28 mb-8">
                        <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-2xl group-hover:bg-indigo-500/40 transition-all duration-500" />
                        <div className="relative w-full h-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-500 backdrop-blur-sm">
                            {isUploading ? (
                                <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                                    <span className="text-sm font-medium text-indigo-500 animate-pulse">Uploading...</span>
                                </div>
                            ) : (
                                <Upload className="w-10 h-10 text-indigo-400" />
                            )}
                        </div>
                    </div>
                </label>

                <div className="flex flex-col items-center gap-6">
                    <div>
                        <h2 className="text-3xl font-bold mb-3 text-foreground">Upload a Photo</h2>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-6">
                            <label
                                htmlFor="upload"
                                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all cursor-pointer shadow-lg active:scale-95"
                            >
                                Choose File
                            </label>

                            <span className="text-muted-foreground font-bold text-sm uppercase px-2">or</span>

                            <label
                                htmlFor="camera-upload"
                                className="px-8 py-3 bg-white dark:bg-white/10 text-foreground border-2 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/20 rounded-xl font-bold transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-2"
                            >
                                <Camera className="w-5 h-5" />
                                Take a Picture
                            </label>
                        </div>
                    </div>

                    <p className="text-muted-foreground dark:text-slate-100 max-w-sm mx-auto text-xl font-medium tracking-tight">
                        Select a high-quality photo to convert into a paint-by-number template.
                    </p>
                </div>
            </div>

            {/* Quality Advisory */}
            <div className="mt-12 glass p-10 md:flex gap-10 items-start rounded-[2.5rem] relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center shrink-0 mb-6 md:mb-0 shadow-inner">
                    <span className="text-3xl">💡</span>
                </div>
                <div>
                    <h3 className="text-2xl font-bold text-foreground mb-3">Pro Tip: Image Quality Matters</h3>
                    <p className="text-xl text-muted-foreground dark:text-slate-200 leading-relaxed mb-6">
                        For the best painting experience, choose photos with:
                    </p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-foreground dark:text-slate-100">
                        {PRO_TIPS.map((tip, i) => (
                            <li key={i} className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                    <Check className="w-3 h-3 text-emerald-400" />
                                </div>
                                <span className="text-xl font-bold text-foreground">{tip}</span>
                            </li>
                        ))}
                    </ul>
                    <div className="mt-8 text-lg bg-slate-100/50 dark:bg-black/40 p-8 rounded-2xl border border-indigo-500/20 dark:border-indigo-500/30 text-muted-foreground dark:text-slate-100 leading-relaxed italic relative z-10">
                        <strong className="text-indigo-600 dark:text-indigo-200 block mb-3 uppercase tracking-[0.2em] text-base font-black">Why does it matter?</strong>
                        Our AI preserves details, but if a face is blurry or completely shadowed in the original photo, it may appear blob-like in the paint-by-numbers pattern.
                    </div>
                </div>
            </div>

            {/* Privacy Micro-Copy */}
            <div className="mt-8 text-center">
                <p className="text-xs text-muted-foreground/60 font-medium flex items-center justify-center gap-2">
                    <Shield className="w-3 h-3" />
                    <span className="opacity-75">Your privacy matters. Photos are processed securely and automatically deleted after 24 hours.</span>
                </p>
            </div>
        </>
    );
}
