'use client'

import { useState } from "react";
import { baseUrl } from "../lib/data/api";
import { ArticleResponse } from "../types/notion";
import { extractArticleProperties } from "../lib/functions/notion";

const useThumbnail = (url: string, title: string) => {
    const [thumbnailUrl, setThumbnailUrl] = useState<string>(url);
    const [reloading, setReloading] = useState<boolean>(false);

    const reload = async () => {
        setReloading(true);

        const response = await fetch(`${baseUrl}/api/database/article?title=${encodeURIComponent(title)}`, {
            method: "POST",
            body: JSON.stringify({
                nextCursor: null,
            }),
        });

        if (response.ok) {
            const articleResponse: ArticleResponse = await response.json();

            const articleData = new ArticleResponse(articleResponse.items, null);

            const properties = extractArticleProperties(articleData.items[0].properties);
            setThumbnailUrl(properties.Thumbnail.url);
        }

        setReloading(false);
    };

    return { thumbnailUrl, reload, reloading, setReloading };
};

export default useThumbnail;