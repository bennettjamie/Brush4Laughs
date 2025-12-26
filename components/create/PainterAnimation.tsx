"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export function PainterAnimation({ progress }: { progress: number }) {
    // Ensure progress is clamped 0-100
    const safeProgress = Math.min(100, Math.max(0, progress));

    return (
        <div className="relative w-full max-w-[600px] aspect-[3/1] mx-auto mb-12 select-none">
            {/* 1. Grayscale Base (The Sketch) */}
            <div className="absolute inset-0 opacity-20 grayscale brightness-125">
                <Image
                    src="/brush4laughs_logo.png"
                    alt="Logo Sketch"
                    fill
                    className="object-contain"
                    priority
                />
            </div>

            {/* 2. Color Reveal (The Paint) */}
            <motion.div
                className="absolute inset-y-0 left-0 overflow-hidden"
                initial={{ width: "0%" }}
                animate={{ width: `${safeProgress}%` }}
                transition={{ ease: "linear", duration: 0.3 }}
            >
                {/* Inner container must be full width to prevent image squishing during clip */}
                <div className="relative w-[600px] h-full">
                    <Image
                        src="/brush4laughs_logo.png"
                        alt="Logo Paint"
                        fill
                        className="object-contain"
                        priority
                    />
                </div>
            </motion.div>

            {/* 3. The Painter (Brush) */}
            <motion.div
                className="absolute top-1/2 z-20"
                style={{
                    height: "180px", // Larger brush (~1.5x)
                    width: "60px",
                    marginTop: "-90px", // Center vertically (half of height)
                    left: `${safeProgress}%`
                }}
                animate={{
                    left: `${safeProgress}%`,
                    y: [0, -15, 0], // Deeper bobbing
                    rotate: [-5, -20, -5, 10, -5], // More deliberate, angled strokes
                }}
                transition={{
                    left: { ease: "linear", duration: 0.3 },
                    y: { repeat: Infinity, duration: 1.2, ease: "easeInOut" }, // Slower, heavier motion
                    rotate: { repeat: Infinity, duration: 0.6, ease: "easeInOut" } // Slower wiggle
                }}
            >
                {/* Offset the brush image so the "tip" is at the left:0 line */}
                <div className="relative w-full h-full -ml-8 transform translate-y-4">
                    <Image
                        src="/brush_only.png"
                        alt="Painter Brush"
                        fill
                        className="object-contain drop-shadow-2xl"
                    />
                </div>
            </motion.div>
        </div>
    );
}
