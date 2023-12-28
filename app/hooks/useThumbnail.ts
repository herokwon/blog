'use client'

import { useEffect, useState } from "react";
import { StaticImport } from "next/dist/shared/lib/get-img-props";

import { ArticleResponse } from "../types/notion";
import { fetchArticle } from "../lib/databases";
import { extractArticleProperties } from "../lib/functions/notion";

const useThumbnail = (src: string | StaticImport | null, title: string | null) => {
    const [imgSrc, setImgSrc] = useState<string | StaticImport | null>(src);
    const [imgLoading, setImgLoading] = useState<boolean>(true);

    const handleImgError = async () => {
        setImgLoading(true);

        if (!title) {
            setImgSrc(null);
            setImgSrc(src);
        } else {
            const response = await fetchArticle({ title: title });
            const articleData = new ArticleResponse(response.items, response.nextCursor);
            const properties = extractArticleProperties(articleData.items[0].properties);

            setImgSrc(properties.Thumbnail.url);
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

    return { imgSrc, imgLoading, handleImgLoad, handleImgError };
};

export default useThumbnail;