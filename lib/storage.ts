import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// Ensure upload directory exists
async function ensureUploadDir() {
    try {
        await fs.access(UPLOAD_DIR);
    } catch {
        await fs.mkdir(UPLOAD_DIR, { recursive: true });
    }
}

export async function saveImage(file: File): Promise<string> {
    await ensureUploadDir();

    const buffer = Buffer.from(await file.arrayBuffer());
    let ext = path.extname(file.name || "");
    if (!ext) {
        if (file.type === "image/jpeg") ext = ".jpg";
        else if (file.type === "image/webp") ext = ".webp";
        else ext = ".png";
    }
    console.log(`Saving file: name=${file.name}, type=${file.type}, ext=${ext}`);
    const filename = `${randomUUID()}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    await fs.writeFile(filepath, buffer);

    // Return the dynamic API URL to ensure runtime serving works
    return `/api/images/${filename}`;
}

export async function getImagePath(url: string): Promise<string> {
    // Convert public URL back to absolute file path
    // url: /uploads/abc.png -> .../public/uploads/abc.png
    const filename = path.basename(url);
    const fullPath = path.join(UPLOAD_DIR, filename);
    console.log(`Resolving path for url ${url} -> ${fullPath}`);
    return fullPath;
}
