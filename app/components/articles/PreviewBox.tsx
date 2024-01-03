'use client'

import Link from "next/link";
import Image from "next/image";

import { ArticleSubProperty } from "@/app/types/notion";
import useThumbnail from "@/app/hooks/useThumbnail";
import Spinner from "../Spinner";
import DateTime from "./DateTime";

export default function PreviewBox({ Category, Title, Date, Thumbnail }: ArticleSubProperty) {
    const { imgSrc, imgLoading, handleImgLoad, handleImgError } = useThumbnail(Thumbnail.url, Title);

    return (
        <Link
            href={Title ? `/posts/${Category}/${Title}` : ""}
            className="preview-box">
            <div className="w-full aspect-[4/3] relative">
                {imgLoading ?
                    <Spinner className="absolute top-0 left-0 z-10" /> :
                    null}
                <Image
                    src={imgSrc ?? Thumbnail.url ?? ""}
                    className={`object-cover object-center ${imgLoading ? "opacity-off" : ""}`}
                    fill
                    sizes="200px"
                    unoptimized
                    onLoad={handleImgLoad}
                    onError={handleImgError}
                    alt="preview-thumbnail" />
            </div>
            <div className="w-full aspect-[4/1] flex flex-col items-center text-center">
                <h2 className=" py-0.5 text-[0.96rem] line-clamp-1">{Title}</h2>
                {Date ?
                    <DateTime date={Date} className="py-0.5" /> :
                    null}
            </div>
        </Link>
    );
}