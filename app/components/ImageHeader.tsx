'use client'

import Image from "next/image";
import { StaticImport } from "next/dist/shared/lib/get-img-props";

import useThumbnail from "../hooks/useThumbnail";
import Spinner from "./Spinner";

export default function ImageHeader({ imageSrc, title }: { imageSrc: string | StaticImport; title?: string }) {
    const { imgSrc, imgLoading, handleImgLoad, handleImgError } = useThumbnail(imageSrc, title ?? null);

    return (
        <div className="w-full h-full absolute top-0 left-0 z-0 bg-dark-secondary">
            {(!imgSrc || typeof imgSrc === "string") && imgLoading ?
                <Spinner className="text-dark absolute top-0 left-0 z-10" /> :
                null}
            <Image
                src={imgSrc ?? imageSrc ?? ""}
                className={`w-full object-cover object-center ${(!imgSrc || typeof imgSrc === "string") && imgLoading ? "brightness-[25%] opacity-10" : ""} opacity-10`}
                fill
                sizes="1x"
                placeholder={!imgSrc || typeof imgSrc === "string" ? "empty" : "blur"}
                priority
                unoptimized
                onLoad={handleImgLoad}
                onError={handleImgError}
                alt="header-image" />
        </div>
    );
}