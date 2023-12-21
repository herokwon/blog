'use client'

import { ArticleCategory } from "@/app/types/notion";
import { HTMLAttributes, MouseEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "../Button";

export default function CategoryButton({ category, ...props }: { category: keyof typeof ArticleCategory } & HTMLAttributes<HTMLButtonElement>) {
    const router = useRouter();

    const handleCategoryClick = (e: MouseEvent) => {
        e.preventDefault();
        router.push(`/posts/${category}`);
    };

    return (
        <Button innerType="text" {...props} className={`article-category ${props.className ?? ""}`} onClick={handleCategoryClick}>
            {ArticleCategory[category]}
        </Button>
    );
}