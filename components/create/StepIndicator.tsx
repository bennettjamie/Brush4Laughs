import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type StepIndicatorProps = {
    current: string;
    step: string;
    label: string;
    completed?: boolean;
};

export function StepIndicator({ current, step, label, completed }: StepIndicatorProps) {
    const steps = ["upload", "crop", "options", "preview"];
    const currentIndex = steps.indexOf(current);
    const stepIndex = steps.indexOf(step);

    const isActive = current === step;
    const isDone = completed || currentIndex > stepIndex;

    return (
        <div className={cn("flex items-center gap-2 px-3 py-1 rounded-full transition-colors", isActive ? "bg-indigo-500/10 text-indigo-300" : "text-slate-500")}>
            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-all duration-300",
                isActive ? "border-indigo-500 bg-indigo-500 text-white shadow-[0_0_15px_-3px_rgba(99,102,241,0.5)] scale-110" :
                    isDone ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" :
                        "border-white/10 bg-white/5")}>
                {isDone ? <Check className="w-3 h-3" /> : stepIndex + 1}
            </div>
            <span className={cn("text-xs font-bold uppercase tracking-wider hidden sm:inline", isActive ? "text-indigo-300" : isDone ? "text-emerald-400/80" : "text-slate-500")}>{label}</span>
        </div>
    );
}
