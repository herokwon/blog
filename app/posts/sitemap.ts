import { MetadataRoute } from "next";

import { BASE_URL } from "@/app/lib/data/constants";
import { fetchArticle } from "@/app/lib/databases";
import { extractArticleProperties } from "@/app/lib/functions/notion";
import { ArticleCategory, ArticleCategoryKeywords, ArticleResponse } from "@/app/types/notion";

export const generateSitemaps = async () => {
    return Object.keys(ArticleCategory).map((category: ArticleCategoryKeywords) => ({
        id: category
    }));
};

export default async function sitemap({ id }: { id: ArticleCategoryKeywords }): Promise<MetadataRoute.Sitemap> {
    const articleData = new ArticleResponse([], null);

    do {
        const response = await fetchArticle({ category: id, startCursor: articleData.nextCursor ?? undefined });
        articleData.items.push(...response.items);
        articleData.nextCursor = response.nextCursor;
    } while (articleData.nextCursor);

    return articleData.items.map((article) => {
        const properties = extractArticleProperties(article.properties);

        return {
            url: `${BASE_URL}/posts/${id}/${encodeURIComponent(properties.Title ?? "")}`,
            lastModified: properties.Date ? new Date(properties.Date) : new Date(),
            changeFrequency: 'daily',
        };
    });
};