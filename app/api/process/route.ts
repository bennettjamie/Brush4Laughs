import { NextRequest, NextResponse } from "next/server";
import { getImagePath } from "@/lib/storage";
import { processImage } from "@/lib/processing/pipeline";
import { saveImage } from "@/lib/storage";

export const maxDuration = 60; // Allow 60 seconds for high-res processing
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '20mb',
        },
    },
};

export async function POST(req: NextRequest) {
    try {
        const { imageUrl, colors, complexity, customDim, faceDetail, bodyDetail, bgDetail, colorOpacity } = await req.json();

        // Validations
        if (!imageUrl) {
            console.warn("[API] Missing imageUrl");
            return NextResponse.json({ error: "Missing imageUrl" }, { status: 400 });
        }

        // Check if it's a blob/base64 from client cropping
        let localPath: string;
        if (imageUrl.startsWith("data:image")) {
            console.log("[API] Processing Base64 Image...");
            // We need to save this data URL to a temporary file first
            const matches = imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                return NextResponse.json({ error: "Invalid data URL" }, { status: 400 });
            }

            const buffer = Buffer.from(matches[2], 'base64');
            const tempFile = new File([buffer], "cropped.png", { type: "image/png" });
            const serverPath = await saveImage(tempFile);
            localPath = await getImagePath(serverPath);
        } else {
            console.log(`[API] Processing Server Image: ${imageUrl}`);
            localPath = await getImagePath(imageUrl);
        }

        console.log(`[API] Pipeline Config: Colors=${colors}, Complexity=${complexity}, Opacity=${colorOpacity}`);

        // Process
        const result = await processImage(
            localPath,
            colors || 24,
            complexity || 5,
            customDim,
            {
                faceDetail,
                bodyDetail,
                bgDetail,
                bgOpacity: (colorOpacity || 15) / 100 // Convert 15 -> 0.15
            }
        );

        return NextResponse.json(result);

    } catch (error) {
        console.error("Processing error:", error);

        // Log to file for debugging
        try {
            const fs = require('fs');
            const path = require('path');
            const logPath = path.join(process.cwd(), 'process-error.log');
            const timestamp = new Date().toISOString();
            const errorMessage = error instanceof Error ? error.stack : String(error);
            fs.appendFileSync(logPath, `[${timestamp}] ${errorMessage}\n\n`);
        } catch (e) {
            console.error("Failed to write to log file", e);
        }

        return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
}
