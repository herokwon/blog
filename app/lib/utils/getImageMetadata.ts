import sharp from "sharp";
import fetch from "node-fetch";

import { ImageMetadata } from "@/app/types/notion";

const getImageMetadata = async (src: string): Promise<ImageMetadata> => {
    const response = await fetch(src);
    const buffer = await response.buffer();

    const base64String = `data:image/png;base64,${buffer.toString("base64")}`;
    const metadata = await sharp(buffer).metadata();

    return {
        base64: base64String,
        width: metadata.width,
        height: metadata.height,
    }
}

export default getImageMetadata;