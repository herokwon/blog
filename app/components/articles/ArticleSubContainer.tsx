'use client'

import { useState } from "react";
import { ArticleProperty } from "@/app/types/notion";
import { getDate } from "@/app/lib/utils/getDate";
import Link from "next/link";
import Image from "next/image";
import CategoryButton from "./CategoryButton";
import useThumbnail from "@/app/hooks/useThumbnail";

type ArticleSubContainer = Pick<ArticleProperty, "Category" | "Title" | "Date" | "Thumbnail">;

export default function ArticleSubContainer({ Category, Title, Date, Thumbnail }: ArticleSubContainer) {
    const [loading, setLoading] = useState<boolean>(true);
    const { thumbnailUrl, reload, reloading, setReloading } = useThumbnail(Thumbnail.url, Title);

    const handleImageLoad = () => {
        const load = setTimeout(() => {
            setLoading(false);
            setReloading(false);
            clearTimeout(load);
        }, 500);
    };

    const handleImageError = () => {
        setReloading(true);
        reload();
    };

    return (
        <Link href={`/posts/${Category}/${encodeURIComponent(Title)}`} className="article-sub-container">
            <div className="h-full aspect-square rounded-lg opacity-bold shadow-2xl overflow-hidden transition-all duration-200 relative">
                <Image src={thumbnailUrl} fill sizes="1x" className={`object-cover object-center ${(loading || reloading) ? "opacity-off" : ""}`} alt="article-thumbnail"
                    onLoad={handleImageLoad} onError={handleImageError} priority />
            </div>
            <div className="h-full flex flex-col justify-between items-start">
                <h3 className="article-info">{Title}</h3>
                <div className="article-info w-full flex justify-between items-center text-[0.72rem]">
                    <CategoryButton category={Category} style={{ padding: "0.1875rem 0.375rem" }} />
                    <span>{getDate(Date)}</span>
                </div>
            </div>
        </Link>
    );
}