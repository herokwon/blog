'use client'

import { HTMLAttributes, MouseEvent } from "react";
import { useRouter } from "next/navigation";

import { ArticleCategory, ArticleCategoryKeywords } from "@/app/types/notion";
import Button from "../Button";

export default function CategoryButton({ category, ...props }: { category: ArticleCategoryKeywords } & HTMLAttributes<HTMLButtonElement>) {
    const router = useRouter();

    const handleCategoryClick = (e: MouseEvent) => {
        e.preventDefault();
        router.push(`/posts/${category}`);
    };

    return (
        <Button innerType="text" {...props} className={`article-info--category ${props.className ?? ""}`} onClick={handleCategoryClick}>
            {ArticleCategory[category]}
        </Button>
    );
}