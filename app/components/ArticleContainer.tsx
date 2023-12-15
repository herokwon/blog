'use client'

import { MouseEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArticleProperty } from "../types/notion";
import { ArticleCategory } from "../lib/data/notion";
import { arrangeArticleSummary } from "../lib/functions/notion";
import { getDate } from "../lib/utils/getDate";
import Link from "next/link";
import Image from "next/image";
import Button from "./Button";

type ArticlePartialProperty = Pick<ArticleProperty, "Category" | "Title" | "Date" | "Thumbnail">;

interface ArticleContainer extends ArticlePartialProperty {
    id: string;
}

export default function ArticleContainer({ id, Category, Title, Date, Thumbnail }: ArticleContainer) {
    const router = useRouter();
    const [summary, setSummary] = useState<string | null>(null);

    const handleCategoryClick = (e: MouseEvent) => {
        e.preventDefault();
        router.push(`/${Category}`);
    };

    useEffect(() => {
        arrangeArticleSummary(id).then((value) => {
            setSummary(value);
        }).catch((e) => {
            setSummary(null);
        })
    }, [id]);

    return (
        <Link href={`${Category}/${encodeURIComponent(Title)}`} className="article-container group">
            <div className="w-full px-2 py-4">
                <div className="article-info flex justify-between items-center">
                    <Button innerType="text" onClick={handleCategoryClick}>
                        {ArticleCategory[Category]}
                    </Button>
                    <p className="px-2 py-1">{getDate(Date)}</p>
                </div>
                <h2 className="article-info line-clamp-1 text-xl font-semibold">{Title}</h2>
                <p className="article-info opacity-off line-clamp-3">{summary}</p>
            </div>
            <div className="opacity-bold dark:opacity-off dark:group-hover:opacity-bold transition-opacity duration-200 relative">
                <Image src={Thumbnail.url} fill sizes="1x" className="object-cover object-center" alt="article-thumbnail" />
            </div>
        </Link>
    );
}