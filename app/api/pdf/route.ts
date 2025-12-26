import { NextRequest, NextResponse } from "next/server";
import { generatePDF } from "@/lib/pdf/generator";
import AdmZip from "adm-zip";

export const config = {
    maxDuration: 60,
    api: {
        bodyParser: {
            sizeLimit: '50mb',
        },
    },
};

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            outlineUrl,
            resultUrl,
            originalUrl,
            palette,
            labels,
            dimensions,
            customDim,
            printSize,
            opacity,
            pdfDimensions, // New field from client
            type // 'kit' | 'canvas' | 'guide'
        } = body;

        // Priority: pdfDimensions (Explicit from Client) > Custom > PrintSize Default
        const finalDim = pdfDimensions || ((printSize?.name === "Custom" && customDim)
            ? customDim
            : (printSize ? { width: printSize.width, height: printSize.height } : (customDim || { width: 16, height: 20 })));

        const pdfs = await generatePDF(
            originalUrl,
            outlineUrl,
            resultUrl, // passed as string
            palette,
            labels as any,
            dimensions,
            finalDim,
            opacity, // Passed opacity
            type // Pass separate type to optimize generation
        );

        // Find Requested File
        if (type === 'canvas') {
            const file = pdfs.find(p => p.fileName.includes("Canvas"));
            if (file) {
                return new NextResponse(new Uint8Array(file.data), {
                    status: 200,
                    headers: {
                        "Content-Type": "application/pdf",
                        "Content-Disposition": `attachment; filename="${file.fileName}"`
                    }
                });
            }
        }

        if (type === 'guide') {
            const file = pdfs.find(p => p.fileName.includes("Guide"));
            if (file) {
                return new NextResponse(new Uint8Array(file.data), {
                    status: 200,
                    headers: {
                        "Content-Type": "application/pdf",
                        "Content-Disposition": `attachment; filename="${file.fileName}"`
                    }
                });
            }
        }

        // Default: Zip
        const zip = new AdmZip();
        pdfs.forEach(pdf => {
            zip.addFile(pdf.fileName, pdf.data);
        });

        const zipBuffer = zip.toBuffer();

        return new NextResponse(new Uint8Array(zipBuffer), {
            status: 200,
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": 'attachment; filename="Brush4Laughs-Kit.zip"'
            }
        });



    } catch (error) {
        console.error("PDF Generation Error (Detailed):");
        if (error instanceof Error) {
            console.error("Message:", error.message);
            console.error("Stack:", error.stack);
        } else {
            console.error(error);
        }
        return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
    }
}
