'use server'

import { getPlaiceholder } from "plaiceholder";

const getImageMetadata = async (src: string) => {
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
        imgMetadata: {
            width, height
        }
    };
};

export default getImageMetadata;