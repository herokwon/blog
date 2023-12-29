'use server'

import { UrlMetadata } from '@/app/types/metadata';
import { BookmarkMetadata } from '@/app/types/notion';
import urlMetadata from 'url-metadata';

export const getMetadata = async (url: string): Promise<BookmarkMetadata> => {
    try {
        const response: unknown = await urlMetadata(url, {
            mode: "same-origin"
        });

        const metadata = response as UrlMetadata;

        const pageUrl = url.at(-1) === "/" ? url.slice(0, url.lastIndexOf("/")) : url;
        const faviconUrl = getMetadataFaviconUrl(pageUrl, metadata.favicons[0].href);
        const imageUrl = getMetadataImageUrl(metadata.image, metadata.jsonld);

        return {
            pageUrl: pageUrl,
            title: metadata.title,
            description: metadata.description,
            faviconUrl: faviconUrl,
            imageUrl: imageUrl,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(message);
    }
};

const getMetadataFaviconUrl = (pageUrl: string, faviconHref: string) => {
    if (faviconHref.includes("https://")) return faviconHref;

    const baseUrl = pageUrl.slice(0, pageUrl.indexOf("/", 10));
    const baseFaviconUrl = faviconHref[0] === "/" ? faviconHref.slice(1) : faviconHref;

    return `${baseUrl}/${baseFaviconUrl}`;
};

const getMetadataImageUrl = (image: string, jsonld: UrlMetadata["jsonld"]): string => {
    if (image.length > 0) return image;
    if (!Array.isArray(jsonld)) return jsonld.image[0];

    return jsonld.find((elem) => 'image' in elem)?.image.url ?? "";
};