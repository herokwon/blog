'use client'

import { useEffect, useState } from "react";
import { baseUrl } from "../lib/data/api";
import { ArticleResponse } from "../types/notion";
import { extractArticleProperties } from "../lib/functions/notion";

const useThumbnail = (url: string, title: string | null) => {
    const [imgUrl, setImgUrl] = useState<string>(url);
    const [imgLoading, setImgLoading] = useState<boolean>(true);

    const handleImgError = async () => {
        setImgLoading(true);

        if (!title) {
            setImgUrl("");
            setImgUrl(url);
        } else {
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
                setImgUrl(properties.Thumbnail.url);
            }
        }
    };

    const handleImgLoad = () => {
        const load = setTimeout(() => {
            setImgLoading(false);
            clearTimeout(load);
        }, 500);
    };

    useEffect(() => {
        setTimeout(() => {
            setImgLoading(false);
        }, 10000);
    }, [imgLoading]);

    return { imgUrl, imgLoading, handleImgLoad, handleImgError };
};

export default useThumbnail;