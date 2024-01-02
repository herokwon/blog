import { MetadataRoute } from "next";

import { BASE_URL } from "@/app/lib/data/constants";
import { navItem } from "./lib/data/navItem";
import { fetchArticle } from "@/app/lib/databases";
import { ArticleResponse } from "@/app/types/notion";
import { extractArticleProperties } from "@/app/lib/functions/notion";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    // page-sitemaps
    const pageSitemap: MetadataRoute.Sitemap = navItem.map((item) => ({
        url: `${BASE_URL}${item.path}`,
        lastModified: new Date(),
        changeFrequency: item.path.includes("https://") ? 'daily' : 'weekly',
    }));

    const articleData = new ArticleResponse([], null);

    do {
        const response = await fetchArticle({ startCursor: articleData.nextCursor ?? undefined });
        articleData.items.push(...response.items);
        articleData.nextCursor = response.nextCursor;
    } while (articleData.nextCursor);

    // article-sitemap
    const articleSitemap: MetadataRoute.Sitemap = articleData.items.map((article) => {
        const properties = extractArticleProperties(article.properties);

        return {
            url: `${BASE_URL}/posts/${properties.Category}/${encodeURIComponent(properties.Title ?? "")}`,
            lastModified: properties.Date ? new Date(properties.Date) : new Date(),
            changeFrequency: 'daily',
        };
    });

    return [...pageSitemap, ...articleSitemap];
};