'use client'

import { useState } from "react";
import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { ArticleResponse } from "@/app/types/notion";
import { extractArticleProperties } from "@/app/lib/functions/notion";
import { Plus } from "lucide-react";
import ArticleContainer from "./ArticleContainer";
import Button from "../Button";

interface ArticleList {
    fetchUrl: RequestInfo;
    nextCursor: string | null;
    children: React.ReactNode;
};

export default function ArticleList({ fetchUrl, nextCursor, children }: ArticleList) {
    const [moreArticles, setMoreArticles] = useState<PageObjectResponse[]>([]);
    const [currentCursor, setCurrentCursor] = useState<string | null>(nextCursor);

    const fetchArticles = async () => {
        if (!currentCursor) return;

        const response = await fetch(fetchUrl, {
            method: "POST",
            body: JSON.stringify({
                nextCursor: currentCursor,
            }),
        });

        if (!response.ok) throw new Error(response.statusText);

        const articleResponse: ArticleResponse = await response.json();
        const articleData = new ArticleResponse(articleResponse.items, articleResponse.nextCursor);

        setMoreArticles([...moreArticles, ...articleData.items]);
        setCurrentCursor(articleData.nextCursor);
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