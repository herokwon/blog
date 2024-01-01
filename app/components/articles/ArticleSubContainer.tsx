'use client'

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

import { ArticleSubProperty } from "@/app/types/notion";
import useThumbnail from "@/app/hooks/useThumbnail";
import CategoryButton from "./CategoryButton";
import Spinner from "../Spinner";
import DateTime from "./DateTime";

interface ArticleSubContainer extends ArticleSubProperty {
    onClick: () => void;
};

export default function ArticleSubContainer({ Category, Title, Date, Thumbnail, onClick }: ArticleSubContainer) {
    const [loading, setLoading] = useState<boolean>(true);
    const { imgSrc, imgLoading, handleImgLoad, handleImgError } = useThumbnail(Thumbnail.url, Title);

    return (
        <Link
            href={Title ? `/posts/${Category}/${encodeURIComponent(Title)}` : ""}
            className="article-sub-container"
            onClick={onClick}>
            <div className="article-info--thumbnail h-full aspect-square shadow-2xl">
                {imgLoading ?
                    <Spinner className="absolute top-0 left-0 z-10" /> :
                    null}
                <Image
                    src={imgSrc ?? Thumbnail.url ?? ""}
                    className={`object-cover object-center ${imgLoading ? "opacity-off" : ""}`}
                    fill
                    sizes="(60px-8px)"
                    priority
                    onLoad={handleImgLoad}
                    onError={handleImgError}
                    alt="article-thumbnail" />
            </div>
            <div className="h-full flex flex-col justify-between items-start">
                <h3 className="article-info--title text-[1rem]">{Title}</h3>
                <div className="w-full flex justify-between items-center">
                    <CategoryButton
                        category={Category}
                        className="px-1.5 py-[0.1875rem]" />
                    {Date ?
                        <DateTime date={Date} /> :
                        null}
                </div>
            </div>
        </Link>
    );
}