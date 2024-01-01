import { getPlaiceholder } from "plaiceholder";
import fetch from "node-fetch";

const getImageMetadata = async (src: string) => {
    const response = await fetch(src);
    const buffer = await response.buffer();

    const { metadata: { width, height },
        ...plaiceholder
    } = await getPlaiceholder(buffer, { size: 12 });

    return {
        ...plaiceholder,
        imgMetadata: { width, height },
    }
}

export default getImageMetadata;