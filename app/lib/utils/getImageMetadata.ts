'use server'

import { GetPlaiceholderReturn, getPlaiceholder } from "plaiceholder";

type ImageMetadata =
    Omit<GetPlaiceholderReturn, "metadata"> & {
        metadata: {
            width: number;
            height: number;
        }
    }

const getImageMetadata = async (src: string): Promise<ImageMetadata> => {
    const buffer = await fetch(src).then(async (response) =>
        Buffer.from(await response.arrayBuffer())
    );

    const {
        metadata: {
            width, height
        },
        ...plaiceholder
    } = await getPlaiceholder(buffer);

    return {
        ...plaiceholder,
        metadata: {
            width, height
        }
    };
};

export default getImageMetadata;