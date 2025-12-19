import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Area } from "react-easy-crop";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// --- Utility to crop image (client-side) ---
export async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
    const image = await new Promise<HTMLImageElement>((resolve) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.src = imageSrc;
        img.onload = () => resolve(img);
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2d context");

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    );

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob!);
        }, "image/png");
    });
}
