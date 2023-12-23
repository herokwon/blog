'use client'

import Image from "next/image";

import Spinner from "./Spinner";
import useThumbnail from "../hooks/useThumbnail";

export default function ImageHeader({ imageUrl, title }: { imageUrl: string; title?: string }) {
    const { imgUrl, imgLoading, handleImgLoad, handleImgError } = useThumbnail(imageUrl, title ?? null);

    return (
        <div className="w-full h-full absolute top-0 left-0 z-0 bg-dark-secondary">
            {imgLoading ?
                <Spinner className="text-dark absolute top-0 left-0 z-10" /> :
                null}
            <Image src={imgUrl ?? imageUrl ?? ""} fill className={`w-full object-cover object-center ${imgLoading ? "brightness-[25%] opacity-10" : ""} opacity-10`} alt="header-image"
                onLoad={handleImgLoad} onError={handleImgError} priority />
        </div>
    );
}