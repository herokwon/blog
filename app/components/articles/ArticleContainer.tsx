'use client'

import { useEffect, useState } from "react";
import { ArticleProperty } from "@/app/types/notion";
import { arrangeArticleSummary } from "@/app/lib/functions/notion";
import { getDate } from "@/app/lib/utils/getDate";
import useThumbnail from "@/app/hooks/useThumbnail";
import Link from "next/link";
import Image from "next/image";
import CategoryButton from "./CategoryButton";
import Spinner from "../Spinner";

type ArticlePartialProperty = Pick<ArticleProperty, "Category" | "Title" | "Date" | "Thumbnail">;

interface ArticleContainer extends ArticlePartialProperty {
    id: string;
}

export default function ArticleContainer({ id, Category, Title, Date, Thumbnail }: ArticleContainer) {
    const [summary, setSummary] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const { imgUrl, imgLoading, handleImgLoad, handleImgError } = useThumbnail(Thumbnail.url, Title);

    useEffect(() => {
        arrangeArticleSummary(id).then((value) => {
            setSummary(value);
        }).catch(() => {
            setSummary(null);
        })
    }, [id]);

    return (
        <Link href={`/posts/${Category}/${encodeURIComponent(Title)}`} className="article-container group">
            <div className="w-full px-2 py-4">
                <div className="article-info flex justify-between items-center">
                    <CategoryButton category={Category} />
                    <p className="px-2 py-1">{getDate(Date)}</p>
                </div>
                <h2 className="article-info line-clamp-1 text-xl font-semibold">{Title}</h2>
                <p className="article-info opacity-off line-clamp-3">{summary}</p>
            </div>
            <div className="opacity-bold dark:opacity-off dark:group-hover:opacity-bold transition-opacity duration-200 relative">
                {imgLoading && <Spinner className="absolute top-0 left-0 z-10" />}
                <Image src={imgUrl} fill sizes="1x" className={`object-cover object-center ${imgLoading ? "opacity-off" : ""}`} alt="article-thumbnail"
                    onLoad={handleImgLoad} onError={handleImgError} priority />
            </div>
        </Link>
    );
}