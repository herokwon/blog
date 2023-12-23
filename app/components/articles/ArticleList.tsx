'use client'

import { useState } from "react";
import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { Plus } from "lucide-react";

import { ArticleCategory } from "@/app/types/notion";
import { fetchArticle } from "@/app/lib/databases";
import { extractArticleProperties } from "@/app/lib/functions/notion";
import ArticleContainer from "./ArticleContainer";
import Button from "../Button";

interface ArticleList {
    category: keyof typeof ArticleCategory;
    nextCursor: string | null;
    children: React.ReactNode;
};

export default function ArticleList({ category, nextCursor, children }: ArticleList) {
    const [moreArticles, setMoreArticles] = useState<PageObjectResponse[]>([]);
    const [currentCursor, setCurrentCursor] = useState<string | null>(nextCursor);

    const fetchArticles = async () => {
        if (!currentCursor) return;

        const response = await fetchArticle({ category: category, startCursor: nextCursor ?? undefined });

        setMoreArticles([...moreArticles, ...response.items]);
        setCurrentCursor(response.nextCursor);
    };

    return (
        <>
            <article className="article-list">
                {children}
                {moreArticles.map((article) => {
                    const properties = extractArticleProperties(article.properties);

                    return (
                        <ArticleContainer
                            key={article.id}
                            id={article.id}
                            Category={properties.Category}
                            Title={properties.Title}
                            Date={properties.Date}
                            Thumbnail={properties.Thumbnail} />
                    );
                })}
            </article>
            <div className={`w-full py-4 my-4 ${currentCursor ? "flex" : "hidden"} justify-center items-center`}>
                <Button innerType="text" className="font-semibold bg-light-tertiary dark:bg-dark-tertiary hover:text-dark hover:bg-dark-tertiary dark:hover:text-light dark:hover:bg-light-tertiary" onClick={fetchArticles}>
                    더 보기<Plus size={16} className="ml-2" />
                </Button>
            </div>
        </>
    );
}