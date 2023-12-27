'use server'

import { ArticleCategory, ArticleCategoryKeywords, PreviewArticles } from "@/app/types/notion";
import { fetchArticle } from "../databases";
import { extractArticleProperties } from "./notion";

export const fetchPreviewArticles = async () => {
    const previewArticles = {};

    for (const category of Object.keys(ArticleCategory)) {
        const categoryKeyword = category as ArticleCategoryKeywords;
        const response = await fetchArticle({ category: categoryKeyword, pageSize: 3 });
        const articleProperties = response.items.map((article) => extractArticleProperties(article.properties));

        previewArticles[categoryKeyword] = articleProperties;
    }

    return previewArticles as PreviewArticles;
};