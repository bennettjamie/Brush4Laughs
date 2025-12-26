
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const INPUT_PATH = path.join(process.cwd(), 'public/brush_only.png');
const OUTPUT_PATH = path.join(process.cwd(), 'public/brush_only.png'); // OVERWRITE directly as requested

async function removeBackground() {
    try {
        console.log(`Processing ${INPUT_PATH}...`);

        // Read input first to buffer to allow overwriting
        const inputBuffer = await fs.promises.readFile(INPUT_PATH);

        const image = sharp(inputBuffer);
        const { width, height } = await image.metadata();

        if (!width || !height) throw new Error("Could not get image metadata");

        const buffer = await image
            .ensureAlpha()
            .raw()
            .toBuffer();

        let whitePixels = 0;

        for (let i = 0; i < buffer.length; i += 4) {
            const r = buffer[i];
            const g = buffer[i + 1];
            const b = buffer[i + 2];

            // Threshold for "White" (allow off-white)
            if (r > 230 && g > 230 && b > 230) {
                buffer[i + 3] = 0; // Set Alpha to 0
                whitePixels++;
            }
        }

        console.log(`Made ${whitePixels} pixels transparent.`);

        const tempPath = OUTPUT_PATH.replace('.png', '_temp.png');
        await sharp(buffer, { raw: { width, height, channels: 4 } })
            .png()
            .toFile(tempPath);

        // Replace original
        await fs.promises.unlink(OUTPUT_PATH).catch(() => { }); // Delete original if exists (it does)
        await fs.promises.rename(tempPath, OUTPUT_PATH);

        console.log(`Successfully updated ${OUTPUT_PATH}`);
    } catch (error) {
        console.error("Error processing image:", error);
    }
}

removeBackground();
