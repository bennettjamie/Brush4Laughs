import { NextRequest, NextResponse } from "next/server";
import { saveImage } from "@/lib/storage";

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '20mb',
        },
    },
};

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Basic validation
        if (!file.type.startsWith("image/")) {
            return NextResponse.json({ error: "Invalid file type. Please upload an image." }, { status: 400 });
        }

        // 20MB limit
        if (file.size > 20 * 1024 * 1024) {
            return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 400 });
        }

        const url = await saveImage(file);

        return NextResponse.json({ url });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
