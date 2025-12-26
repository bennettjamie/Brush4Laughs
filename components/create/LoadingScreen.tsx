import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LOADING_STEPS } from "@/lib/constants";
import { PainterAnimation } from "./PainterAnimation";

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
    // Extended Unique Messages
    "Simulating brush strokes...",
    "Balancing tonal values...",
    "Mapping color regions...",
    "Detecting intricate edges...",
    "Removing digital noise...",
    "Sharpening fine details...",
    "Calibrating opacity levels...",
    "Synthesizing final output...",
    "Checking region paintability...",
    "Optimizing number placement...",
    "Reviewing canvas geometry...",
    "Applying artistic filters...",
    "Processing high-res details...",
    "Merging similar zones...",
    "Enhancing visual clarity...",
    "Preparing digital easel...",
    "Mixing virtual pigments...",
    "Drafting outline layers...",
    "Composing final layout...",
    "Adjusting contrast curves...",
    "Refining micro-details...",
    "Validating print resolution...",
    "Generating color guide...",
    "Structuring number map...",
    "Final polishing pass...",
    "Ensuring artifact-free output...",
    "Checking localized contrast...",
    "Optimizing for acrylics...",
    "rendering final vectors...",
    "Almost ready for you...",
    "Wrapping up the magic...",
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
                setMessageIndex(prev => {
                    // Loop the last 5 messages to keep UI alive indefinitely
                    if (prev >= REASSURANCE_MESSAGES.length - 1) {
                        return REASSURANCE_MESSAGES.length - 5;
                    }
                    return prev + 1;
                });
            }, 3500);
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
            <div className="relative mb-2 w-full max-w-2xl px-4">
                <PainterAnimation progress={loadingProgress} />
                {/* Disclaimer Message */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 5 }}
                    className="text-center text-lg md:text-xl font-medium text-muted-foreground mt-4 mb-8"
                >
                    This work will take some time, you might want to come back in a bit.
                </motion.p>
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
