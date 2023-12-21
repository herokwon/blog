'use client'

import { ArticleCategory } from "@/app/types/notion";
import { CSSProperties, MouseEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "../Button";

export default function CategoryButton({ category, style }: { category: keyof typeof ArticleCategory; style?: CSSProperties }) {
    const router = useRouter();

    const handleCategoryClick = (e: MouseEvent) => {
        e.preventDefault();
        router.push(`/posts/${category}`)
    };

    return (
        <Button innerType="text" className="article-category" onClick={handleCategoryClick} style={style ?? null}>
            {ArticleCategory[category]}
        </Button>
    );
}