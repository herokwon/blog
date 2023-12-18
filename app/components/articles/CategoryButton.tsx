'use client'

import { ArticleCategory } from "@/app/lib/data/notion";
import { CSSProperties, MouseEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "../Button";

export default function CategoryButton({ category, style }: { category: string; style?: CSSProperties }) {
    const router = useRouter();

    const handleCategoryClick = (e: MouseEvent) => {
        e.preventDefault();
        router.push(`/posts/${category}`)
    };

    return (
        <Button innerType="text" onClick={handleCategoryClick} style={style ?? null}>
            {ArticleCategory[category]}
        </Button>
    );
}