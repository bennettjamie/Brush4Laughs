export interface ProcessingOptions {
    imagePath: string;
    numColors: number;
    complexity: number;
    customDim?: { width: number; height: number };
    faceDetail?: number; // 0-100
    bodyDetail?: number; // 0-100
    bgDetail?: number; // 0-100
    textDetail?: number; // 0-100 (New: Text Clarity)
    bgOpacity?: number; // 0.0-1.0
}

export interface PreprocessResult {
    data: Buffer;
    info: { width: number; height: number; channels: number };
    width: number;
    height: number;
    faces?: {
        x: number;
        y: number;
        width: number;
        height: number;
        score: number;
        landmarks?: {
            leftEye?: [number, number];
            rightEye?: [number, number];
            mouth?: [number, number];
            nose?: [number, number];
        }
    }[];
    text?: { x: number, y: number, width: number, height: number, confidence: number, text: string }[];
    mask?: Uint8Array; // 0=Background, 1=Subject
    faceDetail?: number;
    bodyDetail?: number;
    bgDetail?: number;
    textDetail?: number;
}

export interface QuantizeResult {
    centroids: number[][]; // Sorted centroids [r, g, b]
    oldToNewIdx: number[]; // Mapping from k-means raw index to sorted index
    rawCentroids: number[][]; // Original k-means output
}

export interface SegmentationResult {
    indexMap: Int32Array;
    counts: number[]; // Pixel counts per index
    totalOpaquePixels: number;
}
