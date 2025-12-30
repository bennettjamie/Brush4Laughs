import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Area } from "react-easy-crop";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// --- Utility to crop image (client-side) ---
export async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.src = imageSrc;
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(new Error(`Failed to load image for cropping: ${e}`));
    });

    // --- Smart Resize Logic ---
    // If the crop is huge (e.g. 4000px from a phone), we resize it down to MAX_DIM
    // This dramatically reduces upload size while keeping enough quality for Paint-by-Numbers.
    const MAX_DIM = 2048;
    let width = pixelCrop.width;
    let height = pixelCrop.height;

    if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = width / height;
        if (width > height) {
            width = MAX_DIM;
            height = Math.round(MAX_DIM / ratio);
        } else {
            height = MAX_DIM;
            width = Math.round(MAX_DIM * ratio);
        }
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2d context");

    canvas.width = width;
    canvas.height = height;

    // Draw and scale automatically
    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        width,
        height
    );

    return new Promise((resolve) => {
        // Use JPEG with 90% quality for perfect balance of size/quality
        canvas.toBlob((blob) => {
            resolve(blob!);
        }, "image/jpeg", 0.90);
    });
}
