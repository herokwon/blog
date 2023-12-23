'use client'

import { useState } from "react";
import { ArticleProperty } from "@/app/types/notion";
import { getDate } from "@/app/lib/utils/getDate";
import useThumbnail from "@/app/hooks/useThumbnail";
import Link from "next/link";
import Image from "next/image";
import CategoryButton from "./CategoryButton";
import Spinner from "../Spinner";

type ArticleSubProperty = Pick<ArticleProperty, "Category" | "Title" | "Date" | "Thumbnail">;

interface ArticleSubContainer extends ArticleSubProperty {
    onClick: () => void;
};

export default function ArticleSubContainer({ Category, Title, Date, Thumbnail, onClick }: ArticleSubContainer) {
    const [loading, setLoading] = useState<boolean>(true);
    const { imgUrl, imgLoading, handleImgLoad, handleImgError } = useThumbnail(Thumbnail.url, Title);

    return (
        <Link href={Title ? `/posts/${Category}/${encodeURIComponent(Title)}` : ""} className="article-sub-container"
            onClick={onClick}>
            <div className="h-full aspect-square rounded-lg opacity-bold shadow-2xl overflow-hidden transition-all duration-200 relative">
                {imgLoading ?
                    <Spinner className="absolute top-0 left-0 z-10" /> :
                    null}
                <Image src={imgUrl ?? Thumbnail.url ?? ""} fill className={`object-cover object-center ${imgLoading ? "opacity-off" : ""}`} alt="article-thumbnail"
                    onLoad={handleImgLoad} onError={handleImgError} priority />
            </div>
            <div className="h-full flex flex-col justify-between items-start">
                <h3 className="article-info">{Title}</h3>
                <div className="article-info w-full flex justify-between items-center text-[0.72rem]">
                    <CategoryButton category={Category} className="px-1.5 py-[0.1875rem]" />
                    {Date ?
                        <span>{getDate(Date)}</span> :
                        null}
                </div>
            </div>
        </Link>
    );
}