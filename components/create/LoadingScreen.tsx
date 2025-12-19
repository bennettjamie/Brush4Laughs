import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { LOADING_STEPS } from "@/lib/constants";

type LoadingScreenProps = {
    loadingStep: number;
    loadingProgress: number;
    colors: number;
    printSizeName: string;
};

const REASSURANCE_MESSAGES = [
    "This will take a minute or so...",
    "Polishing Digital Canvas...",
    "Still working our magic...",
    "Simplifying complex regions...",
    "Almost there, perfecting the details...",
    "Finalizing numbers for your kit...",
    "Ensuring precision...",
    "Just a moment longer...",
    "Creating clear boundaries...",
    "Analyzing color harmony...",
    "Enhancing edge readability...",
    "Optimizing for 20x20 canvas...",
    "Double-checking small details...",
    "Refining palette selection...",
    "Generating studio-grade outlines...",
    "Smoothing brush paths...",
    "Calculating final dimensions...",
    "Verifying color contrast...",
    "Preparing preview assets...",
    "Thank you for your patience...",
    "Nearly finished, preparing preview...",
];

export function LoadingScreen({ loadingStep, loadingProgress, colors, printSizeName }: LoadingScreenProps) {
    const activeStep = LOADING_STEPS[loadingStep] || LOADING_STEPS[0];
    const isLastStep = loadingStep === LOADING_STEPS.length - 1;
    const [messageIndex, setMessageIndex] = useState(0);

    useEffect(() => {
        if (isLastStep) {
            const interval = setInterval(() => {
                setMessageIndex(prev => Math.min(prev + 1, REASSURANCE_MESSAGES.length - 1));
            }, 4500);
            return () => clearInterval(interval);
        } else {
            setMessageIndex(0);
        }
    }, [isLastStep]);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="text-center py-16 md:py-32 flex flex-col items-center max-w-2xl mx-auto w-full relative z-10"
        >
            <div className="relative mb-16">
                {/* Outer pulsing ring */}
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.1, 0.3, 0.1]
                    }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-[-20px] bg-indigo-500 rounded-full blur-3xl"
                />

                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="w-32 h-32 md:w-40 md:h-40 rounded-full border-[1px] border-indigo-500/20 border-t-indigo-500 shadow-[inset_0_0_20px_rgba(99,102,241,0.1)]"
                />
                <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 flex items-center justify-center"
                >
                    <div className="w-20 h-20 md:w-24 md:h-24 bg-background border border-foreground/10 rounded-full flex items-center justify-center shadow-2xl backdrop-blur-xl">
                        <Loader2 className="w-10 h-10 md:w-12 md:h-12 text-indigo-500 dark:text-indigo-400 animate-spin-slow" />
                    </div>
                </motion.div>
            </div>

            <motion.div
                key={loadingStep + "header"}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-1 mb-8"
            >
                <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-foreground bg-clip-text text-transparent bg-gradient-to-b from-slate-950 via-slate-800 to-slate-600 dark:from-white dark:via-white dark:to-white/60">
                    Studio <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-violet-500 dark:from-indigo-400 dark:to-violet-400">Synthesis</span>
                </h2>
                <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-muted-foreground">Brush4Laughs Studio Edition</div>
            </motion.div>

            <div className="w-full bg-foreground/5 h-1.5 md:h-2 rounded-full overflow-hidden mb-8 border border-foreground/5 shadow-inner max-w-md">
                <motion.div
                    className="h-full bg-gradient-to-r from-indigo-600 via-violet-500 to-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.5)]"
                    animate={{ width: `${loadingProgress}%` }}
                    transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                />
            </div>

            <div className="flex flex-col items-center gap-4 min-h-[80px]">
                <div className="flex items-center gap-4 text-indigo-300 font-bold uppercase tracking-[0.3em] text-[10px] md:text-xs bg-indigo-500/10 px-6 py-2 rounded-full border border-indigo-500/20">
                    <span className="animate-pulse">{activeStep.icon}</span>
                    <AnimatePresence mode="wait">
                        <motion.span
                            key={isLastStep ? REASSURANCE_MESSAGES[messageIndex] : activeStep.label}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                        >
                            {isLastStep ? REASSURANCE_MESSAGES[messageIndex] : activeStep.label}
                        </motion.span>
                    </AnimatePresence>
                </div>
                <p className="text-slate-500 text-xs md:text-sm font-medium max-w-xs md:max-w-md italic leading-relaxed">
                    Orchestrating a {colors}-color masterpiece for your {printSizeName} canvas.
                </p>
            </div>
        </motion.div>
    );
}
