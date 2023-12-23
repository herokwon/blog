'use client'

import { useEffect, useState } from "react";
import { fetchArticle } from "../lib/databases";
import { ArticleResponse } from "../types/notion";
import { extractArticleProperties } from "../lib/functions/notion";

const useThumbnail = (url: string | null, title: string | null) => {
    const [imgUrl, setImgUrl] = useState<string | null>(url);
    const [imgLoading, setImgLoading] = useState<boolean>(true);

    const handleImgError = async () => {
        setImgLoading(true);

        if (!title) {
            setImgUrl("");
            setImgUrl(url);
        } else {
            const response = await fetchArticle({ title: title });
            const articleData = new ArticleResponse(response.items, response.nextCursor);
            const properties = extractArticleProperties(articleData.items[0].properties);

            setImgUrl(properties.Thumbnail.url);
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