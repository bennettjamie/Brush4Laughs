"use client";

import { useState, useCallback, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { Point, Area } from "react-easy-crop";
import { generateClientCanvasPDF } from "@/lib/pdf/client-generator";

// Utilities & Constants
import { getCroppedImg } from "@/lib/utils";

import { PRINT_SIZES, LOADING_STEPS, PrintSize } from "@/lib/constants";

// Components
import { StepIndicator } from "@/components/create/StepIndicator";
import { UploadStep } from "@/components/create/UploadStep";
import { CropStep } from "@/components/create/CropStep";
import { OptionsStep } from "@/components/create/OptionsStep";
import { PreviewStep } from "@/components/create/PreviewStep";
import { LoadingScreen } from "@/components/create/LoadingScreen";

export default function CreatePage() {
    const [step, setStep] = useState<"upload" | "crop" | "options" | "preview">("upload");
    const [isUploading, setIsUploading] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    // Crop state
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [printSize, setPrintSize] = useState<PrintSize>(PRINT_SIZES[1]); // Default: Tabloid
    const [isLandscape, setIsLandscape] = useState(false);
    const [customDim, setCustomDim] = useState({ width: 16, height: 20 });
    const [aspect, setAspect] = useState<number>(11 / 17);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [croppedImage, setCroppedImage] = useState<string | null>(null);

    // Options state
    const [colors, setColors] = useState(24);
    const [complexity, setComplexity] = useState(6);
    const [colorOpacity, setColorOpacity] = useState(15);
    // Detail State
    const [faceDetail, setFaceDetail] = useState(50);
    const [bodyDetail, setBodyDetail] = useState(50);
    const [bgDetail, setBgDetail] = useState(50);
    const [textDetail, setTextDetail] = useState(10); // Default 10% (Low/Safe protection)

    // Result state
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [outlineImage, setOutlineImage] = useState<string | null>(null);
    const [palette, setPalette] = useState<any[]>([]);
    const [labels, setLabels] = useState<any[]>([]);
    const [dimensions, setDimensions] = useState<{ width: number, height: number } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingStep, setLoadingStep] = useState(0);
    const [unit, setUnit] = useState<"ml" | "oz">("ml");
    const [opacity, setOpacity] = useState(50);
    const [sizeUnit, setSizeUnit] = useState<"in" | "cm">("in");

    // --- Side Effects ---

    // Progress Simulation
    useEffect(() => {
        if (isProcessing) {
            setLoadingProgress(0);
            setLoadingStep(0);
            const interval = setInterval(() => {
                setLoadingProgress(prev => {
                    // "Zeno's Paradox" Simulation (Slower & Heavier):
                    // Move 0.5% of the remaining distance to 98% every tick.
                    // This makes the bar feel like it has "weight" and avoids the "almost done" fake-out.
                    if (prev >= 98) return 98;
                    const remaining = 98 - prev;
                    const inc = Math.max(0.05, remaining * 0.005); // Much slower decay
                    return prev + inc;
                });
            }, 600); // Slower tick rate (600ms)
            return () => clearInterval(interval);
        } else {
            setLoadingProgress(100);
        }
    }, [isProcessing]);

    useEffect(() => {
        const stepIndex = Math.min(
            Math.floor((loadingProgress / 100) * LOADING_STEPS.length),
            LOADING_STEPS.length - 1
        );
        setLoadingStep(stepIndex);
    }, [loadingProgress]);

    // --- Handlers ---

    const updateAspect = useCallback((size: PrintSize, landscape: boolean, custom: { width: number, height: number }) => {
        let w = size.name === "Custom" ? custom.width : size.width;
        let h = size.name === "Custom" ? custom.height : size.height;

        if (size.category !== "Square") {
            if (landscape && h > w) [w, h] = [h, w];
            if (!landscape && w > h) [w, h] = [h, w];
        }
        setAspect(w / h);
    }, []);

    const handleOrientationChange = (newLandscape: boolean) => {
        setIsLandscape(newLandscape);
        let newCustom = { ...customDim };
        if (printSize.name === "Custom") {
            if (newLandscape && newCustom.height > newCustom.width) {
                newCustom = { width: newCustom.height, height: newCustom.width };
            } else if (!newLandscape && newCustom.width > newCustom.height) {
                newCustom = { width: newCustom.height, height: newCustom.width };
            }
            setCustomDim(newCustom);
        }
        updateAspect(printSize, newLandscape, newCustom);
    };

    const handlePrintSizeSelect = (size: PrintSize) => {
        setPrintSize(size);
        updateAspect(size, isLandscape, customDim);
    };

    const handleCustomDimChange = (field: 'width' | 'height', val: string) => {
        const num = parseFloat(val) || 0;
        const newDim = { ...customDim, [field]: num };
        setCustomDim(newDim);
        if (printSize.name === "Custom") {
            updateAspect(printSize, isLandscape, newDim);
        }
    };

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        try {
            const res = await fetch("/api/upload", { method: "POST", body: formData });
            if (!res.ok) throw new Error("Upload failed");
            const data = await res.json();
            if (data.url) {
                // Auto-detect orientation
                const img = new Image();
                img.onload = () => {
                    const isImgLandscape = img.naturalWidth > img.naturalHeight;
                    // Auto-set orientation
                    setIsLandscape(isImgLandscape);

                    // Auto-update Custom dims if needed logic is same as handleOrientationChange
                    // Check if we need to swap dimensions for current printSize
                    let w = printSize.name === "Custom" ? customDim.width : printSize.width;
                    let h = printSize.name === "Custom" ? customDim.height : printSize.height;

                    if (printSize.category !== "Square") {
                        // Force the "Shape" to match image
                        if (isImgLandscape && h > w) {
                            // Swap to match landscape
                            if (printSize.name === "Custom") setCustomDim({ width: h, height: w });
                            // If preset, updateAspect handles logic below
                        } else if (!isImgLandscape && w > h) {
                            // Swap to match portrait
                            if (printSize.name === "Custom") setCustomDim({ width: h, height: w });
                        }
                    }

                    // Calculate Correct Aspect for the new orientation
                    // We must reproduce the updateAspect logic with the NEW landscape value
                    let finalW = printSize.name === "Custom" ? (isImgLandscape ? Math.max(customDim.width, customDim.height) : Math.min(customDim.width, customDim.height)) : printSize.width;
                    let finalH = printSize.name === "Custom" ? (isImgLandscape ? Math.min(customDim.width, customDim.height) : Math.max(customDim.width, customDim.height)) : printSize.height;

                    // Standard presets might need swapping just for the aspect calculation
                    if (printSize.category !== "Square") {
                        if (isImgLandscape && finalH > finalW) [finalW, finalH] = [finalH, finalW];
                        if (!isImgLandscape && finalW > finalH) [finalW, finalH] = [finalH, finalW];
                    }

                    setAspect(finalW / finalH);
                };
                img.src = data.url;

                setImageUrl(data.url);
                setStep("crop");
            }
        } catch (err) {
            console.error(err);
            alert("Failed to upload image");
        } finally {
            setIsUploading(false);
        }
    };

    const handleCropConfirm = async () => {
        if (imageUrl && croppedAreaPixels) {
            try {
                setIsUploading(true);
                const blob = await getCroppedImg(imageUrl, croppedAreaPixels);
                // Use JPEG extension and type to match the util's new output
                const file = new File([blob], "cropped-selection.jpg", { type: "image/jpeg" });
                const formData = new FormData();
                formData.append("file", file);
                const res = await fetch("/api/upload", { method: "POST", body: formData });
                if (!res.ok) throw new Error("Upload crop failed");
                const data = await res.json();
                setCroppedImage(data.url);
                setStep("options");
            } catch (e: any) {
                console.error(e);
                alert(`Error saving crop: ${e.message}`);
            } finally {
                setIsUploading(false);
            }
        } else {
            setStep("options");
        }
    };

    const generatePreview = async () => {
        if (!croppedImage) return;
        setIsProcessing(true);
        setStep("preview");
        const targetW = printSize.name === "Custom" ? customDim.width : printSize.width;
        const targetH = printSize.name === "Custom" ? customDim.height : printSize.height;

        try {
            const res = await fetch("/api/process", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    imageUrl: croppedImage,
                    colors,
                    complexity,
                    customDim: { width: targetW, height: targetH },
                    faceDetail,
                    bodyDetail,
                    bgDetail,
                    textDetail, // Pass new param
                    bgOpacity: colorOpacity / 100
                })
            });
            if (!res.ok) throw new Error("Processing failed");
            const data = await res.json();
            setResultImage(data.outputUrl);
            setOutlineImage(data.outlineUrl);
            setPalette(data.palette);
            setLabels(data.labels || []);
            setDimensions(data.dimensions || { width: 800, height: 800 });
        } catch (err) {
            console.error(err);
            alert("Processing failed");
            setStep("options");
        } finally {
            setIsProcessing(false);
        }
    };

    const [downloadingType, setDownloadingType] = useState<"canvas" | "guide" | "canvas-reverse" | null>(null);
    const [guideBlob, setGuideBlob] = useState<Blob | null>(null);

    // BACKGROUND GENERATION: Prefetch Guide PDF
    // We only prefetch if we have results. If opacity/unit changes, we should ideally re-fetch or just invalidate.
    // For now, let's prefetch on initial load of preview. Debounce could work for updates.
    useEffect(() => {
        if (step === "preview" && resultImage && outlineImage) {
            // Invalidate current cache immediately so we don't serve stale content if user clicks fast
            setGuideBlob(null);

            // Define formatting variables locally to match the ones used in download (or use current state)
            const targetW = printSize.name === "Custom" ? customDim.width : printSize.width;
            const targetH = printSize.name === "Custom" ? customDim.height : printSize.height;

            const prefetchController = new AbortController();

            console.log("[Prefetch] Starting background Guide generation...");
            fetch("/api/pdf", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    outlineUrl: outlineImage,
                    resultUrl: resultImage,
                    originalUrl: croppedImage,
                    palette,
                    labels,
                    dimensions,
                    unit,
                    printSize,
                    customDim,
                    pdfDimensions: { width: targetW, height: targetH },
                    opacity, // Current opacity
                    type: "guide"
                }),
                signal: prefetchController.signal
            })
                .then(res => {
                    if (res.ok) return res.blob();
                    throw new Error("Prefetch failed");
                })
                .then(blob => {
                    console.log("[Prefetch] Guide ready.");
                    setGuideBlob(blob);
                })
                .catch(e => {
                    if (e.name !== 'AbortError') console.warn("[Prefetch] Failed behavior", e);
                });

            return () => prefetchController.abort();
        }
    }, [step, resultImage, outlineImage, opacity, unit, printSize, customDim]); // Re-run if these change? Yes, but maybe debounce it?
    // Note: React's strict mode might double-fetch in dev, that's okay.
    // Ideally we debounce the opacity slider so we don't spam the server.
    // But for now, this basic implementation fulfills the requirement "start processing... after final page loads".


    const handleDownload = async (type: "canvas" | "guide" | "canvas-reverse") => {
        setDownloadingType(type);

        let finalPrintSize = printSize;
        if (printSize.name === "Custom") {
            finalPrintSize = { ...printSize, width: customDim.width, height: customDim.height };
        }
        // Auto-detect orientation from the actual crop geometry
        const cropW = croppedAreaPixels?.width || 0;
        const cropH = croppedAreaPixels?.height || 0;
        const effectiveLandscape = cropW > cropH;

        let baseW = printSize.width;
        let baseH = printSize.height;

        if (printSize.name === "Custom") {
            baseW = customDim.width;
            baseH = customDim.height;
        }

        const maxDim = Math.max(baseW, baseH);
        const minDim = Math.min(baseW, baseH);

        const targetW = effectiveLandscape ? maxDim : minDim;
        const targetH = effectiveLandscape ? minDim : maxDim;

        // CLIENT-SIDE GENERATION FOR CANVAS & CANVAS-REVERSE
        if ((type === "canvas" || type === "canvas-reverse") && outlineImage && resultImage && labels && dimensions) {
            try {
                const doc = await generateClientCanvasPDF(
                    outlineImage,
                    resultImage,
                    opacity,
                    labels, // Ensure pipeline.ts returns compatible labels
                    dimensions,
                    { width: targetW, height: targetH },
                    { mirror: type === "canvas-reverse" }
                );
                const fname = type === "canvas-reverse" ? "Canvas-Reverse" : "Canvas";
                doc.save(`Brush4Laughs-${fname}-${targetW}x${targetH}.pdf`);
            } catch (e) {
                console.error("Client-side PDF failed", e);
                alert("Failed to generate PDF");
            } finally {
                setDownloadingType(null);
            }
            return;
        }

        // SERVER-SIDE GENERATION FOR GUIDE (Fallback)
        try {
            // Check cache first
            if (type === "guide" && guideBlob) {
                console.log("[Download] Using cached Guide blob.");
                const url = window.URL.createObjectURL(guideBlob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "Brush4Laughs-Guide.pdf";
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                setDownloadingType(null);
                return;
            }

            fetch("/api/pdf", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    outlineUrl: outlineImage,
                    resultUrl: resultImage,
                    originalUrl: croppedImage,
                    palette,
                    labels,
                    dimensions,
                    unit,
                    printSize,
                    customDim,
                    pdfDimensions: { width: targetW, height: targetH }, // Explicit dimensions
                    opacity,
                    type // Pass the type
                })
            })
                .then(res => {
                    if (!res.ok) throw new Error("PDF generation failed");
                    return res.blob();
                })
                .then(blob => {
                    // Update cache too?
                    if (type === "guide") setGuideBlob(blob);

                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    // Filename Logic
                    a.download = "Brush4Laughs-Guide.pdf";

                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                })
                .catch(err => {
                    console.error(err);
                    alert("Failed to generate PDF");
                })
                .finally(() => {
                    setDownloadingType(null);
                });
        } catch (e) {
            console.error(e);
            setDownloadingType(null);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-indigo-500/30 font-sans overflow-x-hidden relative">
            {/* Dynamic Ambient Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] bg-violet-600/10 rounded-full blur-[100px]" style={{ animationDelay: '2s' }} />
                <div className="absolute top-[30%] right-[20%] w-[30%] h-[30%] bg-blue-500/5 rounded-full blur-[80px]" />
            </div>

            <div className="relative z-10 max-w-6xl mx-auto p-4 md:p-8">
                {/* Header / Stepper */}
                <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-8">
                    <div className="flex items-center gap-4 group cursor-default">
                        <div className="relative">
                            <div className="absolute inset-0 bg-indigo-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-60 transition-all duration-700 group-hover:scale-125" />
                            <img
                                src="/brush_only.png"
                                alt="Brush4Laughs Logo"
                                className="w-12 h-12 object-contain relative transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110"
                            />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-2xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-white dark:to-slate-400">
                                Brush4Laughs
                            </span>
                            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400/80 -mt-1 ml-0.5">Studio Edition</span>
                        </div>
                    </div>

                    <div className="flex gap-2 text-sm glass p-2 rounded-full shadow-xl border-slate-200 dark:border-white/5 backdrop-blur-md overflow-x-auto no-scrollbar">
                        <button onClick={() => setStep("upload")} className="focus:outline-none shrink-0 border-none bg-transparent">
                            <StepIndicator current={step} step="upload" label="Upload" completed={!!imageUrl} />
                        </button>
                        <div className="w-4 h-px bg-foreground/10 self-center shrink-0" />
                        <button onClick={() => imageUrl && setStep("crop")} className="focus:outline-none shrink-0 border-none bg-transparent" disabled={!imageUrl}>
                            <StepIndicator current={step} step="crop" label="Crop" completed={!!croppedImage} />
                        </button>
                        <div className="w-4 h-px bg-foreground/10 self-center shrink-0" />
                        <button onClick={() => croppedImage && setStep("options")} className="focus:outline-none shrink-0 border-none bg-transparent" disabled={!croppedImage}>
                            <StepIndicator current={step} step="options" label="Options" completed={!!resultImage} />
                        </button>
                        <div className="w-4 h-px bg-foreground/10 self-center shrink-0" />
                        <button onClick={() => resultImage && setStep("preview")} className="focus:outline-none shrink-0 border-none bg-transparent" disabled={!resultImage}>
                            <StepIndicator current={step} step="preview" label="Preview" completed={false} />
                        </button>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {step === "upload" && (
                        <UploadStep
                            key="upload"
                            isUploading={isUploading}
                            onFileChange={handleFile}
                        />
                    )}

                    {step === "crop" && imageUrl && (
                        <CropStep
                            key="crop"
                            imageUrl={imageUrl}
                            crop={crop}
                            zoom={zoom}
                            aspect={aspect}
                            isLandscape={isLandscape}
                            printSize={printSize}
                            customDim={customDim}
                            isUploading={isUploading}
                            sizeUnit={sizeUnit}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
                            onOrientationChange={handleOrientationChange}
                            onPrintSizeSelect={handlePrintSizeSelect}
                            onCustomDimChange={handleCustomDimChange}
                            onSizeUnitChange={setSizeUnit}
                            onBack={() => setStep("upload")}
                            onNext={handleCropConfirm}
                        />
                    )}

                    {step === "options" && croppedImage && (
                        <OptionsStep
                            key="options"
                            croppedImage={croppedImage}
                            croppedAreaPixels={croppedAreaPixels}
                            colors={colors}
                            complexity={complexity}
                            colorOpacity={colorOpacity}
                            setColors={setColors}
                            setComplexity={setComplexity}
                            setColorOpacity={setColorOpacity}
                            faceDetail={faceDetail}
                            bodyDetail={bodyDetail}
                            bgDetail={bgDetail}
                            textDetail={textDetail} // Pass prop
                            setFaceDetail={setFaceDetail}
                            setBodyDetail={setBodyDetail}
                            setBgDetail={setBgDetail}
                            setTextDetail={setTextDetail} // Pass prop
                            onGenerate={generatePreview}
                            onBack={() => setStep("crop")}
                        />
                    )}

                    {step === "preview" && (
                        <div key="preview-container">
                            {isProcessing ? (
                                <LoadingScreen
                                    loadingStep={loadingStep}
                                    loadingProgress={loadingProgress}
                                    colors={colors}
                                    printSizeName={printSize.name}
                                />
                            ) : (
                                <PreviewStep
                                    resultImage={resultImage}
                                    outlineImage={outlineImage}
                                    palette={palette}
                                    opacity={opacity}
                                    unit={unit}
                                    croppedAreaPixels={croppedAreaPixels}
                                    setOpacity={setOpacity}
                                    setUnit={setUnit}
                                    downloadingType={downloadingType}
                                    onDownload={handleDownload}
                                    onReset={() => setStep("options")}
                                />
                            )}
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
