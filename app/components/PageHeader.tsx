'use client'

import Image from "next/image";
import useThumbnail from "../hooks/useThumbnail";
import Spinner from "./Spinner";

export default function PageHeader({ imageUrl, title, children }: { imageUrl?: string; title?: string; children: React.ReactNode }) {
    const thumbnail = imageUrl ? useThumbnail(imageUrl, title ?? null) : null;

    return (
        <section className="w-full h-[75vh] mb-4 relative">
            {thumbnail ?
                <div className="w-full h-full absolute top-0 left-0 z-0 bg-dark-secondary">
                    {thumbnail.imgLoading && <Spinner className="text-dark absolute top-0 left-0 z-10" />}
                    <Image src={thumbnail.imgUrl ?? imageUrl ?? ""} fill className={`w-full object-cover object-center ${thumbnail.imgLoading ? "brightness-[25%] opacity-10" : ""} opacity-10`} alt="header-image"
                        onLoad={thumbnail.handleImgLoad} onError={thumbnail.handleImgError} priority />
                </div> : null}
            <div className="w-full h-full text-dark absolute top-0 left-0 z-10">
                {children}
            </div>
        </section>
    );
}