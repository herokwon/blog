'use client'

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import { ArticleSubProperty } from "@/app/types/notion";
import { arrangeArticleSummary } from "@/app/lib/functions/notion";
import useThumbnail from "@/app/hooks/useThumbnail";
import CategoryButton from "./CategoryButton";
import Spinner from "../Spinner";
import DateTime from "./DateTime";

interface ArticleContainer extends ArticleSubProperty {
    id: string;
}

export default function ArticleContainer({ id, Category, Title, Date, Thumbnail }: ArticleContainer) {
    const [summary, setSummary] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const { imgSrc, imgLoading, handleImgLoad, handleImgError } = useThumbnail(Thumbnail.url, Title);

    useEffect(() => {
        if (!summary) setLoading(true);
        else {
            const load = setTimeout(() => {
                setLoading(false);
                clearTimeout(load);
            }, 300);
        }
    }, [summary]);

    useEffect(() => {
        arrangeArticleSummary(id).then((value) => {
            setSummary(value);
        }).catch(() => {
            setSummary("데이터를 불러올 수 없습니다.");
        })
    }, [id]);

    return (
        <Link
            href={Title ? `/posts/${Category}/${encodeURIComponent(Title)}` : ""}
            scroll={false}
            className="article-container group">
            <div className="w-full px-2 py-4">
                <div className="w-full flex justify-between items-center">
                    <CategoryButton
                        category={Category}
                        className="dark:bg-blue-600" />
                    {Date ?
                        <DateTime date={Date} className="px-2 py-1" /> :
                        null}
                </div>
                <h2 className="article-info--title text-[1.32rem]">{Title}</h2>
                <div className="article-info--summary relative">
                    {loading ?
                        <Spinner className="absolute top-0 left-0 z-10" /> :
                        summary}
                </div>
            </div>
            <div className="article-info--thumbnail rounded-none dark:opacity-off dark:group-hover:opacity-bold">
                {imgLoading ?
                    <Spinner className="absolute top-0 left-0 z-10" /> :
                    null}
                <Image
                    src={imgSrc ?? Thumbnail.url ?? ""}
                    className={`object-cover object-center ${imgLoading ? "opacity-off" : ""}`}
                    fill
                    sizes="(max-width: 689px) 100vw, (max-width: 1026px) 50vw, 33vw"
                    priority
                    unoptimized
                    onLoad={handleImgLoad}
                    onError={handleImgError}
                    alt="article-thumbnail" />
            </div>
        </Link>
    );
}