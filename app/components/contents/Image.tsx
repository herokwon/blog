'use client'

import { ImageBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { useState } from "react";
import Image from "next/image";

import { ImageBlockData } from "@/app/types/notion";
import { getImage } from "@/app/lib/functions/notion";
import { fetchBlock } from "@/app/lib/databases";
import RichText from "./texts/RichText";

interface Images {
    block: ImageBlockObjectResponse;
    imgData: ImageBlockData;
    base64: string;
    imgMetadata: {
        width: number;
        height: number;
    };
};

export default function Images({ block, imgData, base64, imgMetadata }: Images) {
    const { imgUrl, handleImgError } = useImage(block, imgData);

    return (
        <div className="w-full my-block">
            <div className="article-content--image" style={{ aspectRatio: `${imgMetadata.width}/${imgMetadata.height}` }}>
                <Image
                    src={imgUrl}
                    fill
                    sizes="(max-width: 512px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    placeholder="blur"
                    blurDataURL={base64}
                    unoptimized
                    onError={handleImgError}
                    alt="article-image" />
            </div>
            <div className="article-content--caption">
                <RichText richTexts={block.image.caption} />
            </div>
        </div>
    );
}

const useImage = (block: ImageBlockObjectResponse, imgData: ImageBlockData): { imgUrl: string; handleImgError: () => Promise<void> } => {
    const [imgUrl, setImgUrl] = useState<string>(imgData.url);

    const handleImgError = async () => {
        const response = await fetchBlock(block.id);

        const updatedImgData = getImage(response.block as ImageBlockObjectResponse);
        setImgUrl(updatedImgData.url);
    };

    return { imgUrl, handleImgError };
};