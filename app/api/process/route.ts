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
        const { imageUrl, colors, complexity, customDim, faceDetail, bodyDetail, bgDetail } = await req.json();

        if (!imageUrl) {
            return NextResponse.json({ error: "Missing imageUrl" }, { status: 400 });
        }

        // Since the image might be a data URL (from react-easy-crop) or a server path
        let localPath: string;

        // Check if it's a blob/base64 from client cropping
        if (imageUrl.startsWith("data:image")) {
            // We need to save this data URL to a temporary file first
            const matches = imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                return NextResponse.json({ error: "Invalid data URL" }, { status: 400 });
            }

            const buffer = Buffer.from(matches[2], 'base64');
            const tempFile = new File([buffer], "cropped.png", { type: "image/png" });
            // Re-use our saveImage logic
            const serverPath = await saveImage(tempFile);
            localPath = await getImagePath(serverPath);
        } else {
            // It's a server path already
            localPath = await getImagePath(imageUrl);
        }

        // Process
        const result = await processImage(
            localPath,
            colors || 24,
            complexity || 5,
            customDim,
            { faceDetail, bodyDetail, bgDetail } // Pass Options
        );

        return NextResponse.json(result);

    } catch (error) {
        console.error("Processing error:", error);
        return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
}
