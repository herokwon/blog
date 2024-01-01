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

        const baseUrl = url.slice(0, url.indexOf("/", 10));
        const faviconUrl = await getMetadataFaviconUrl(baseUrl, metadata.favicons);
        const imageUrl = await getMetadataImageUrl(baseUrl, metadata.image, metadata['og:image']);

        return {
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

const getMetadataFromBaseUrl = async (baseUrl: string) => {
    const response: unknown = await urlMetadata(baseUrl, {
        mode: "same-origin"
    });

    return response as UrlMetadata;
};

const getMetadataFaviconUrl = async (baseUrl: string, favicons: { href: string }[]): Promise<string | null> => {
    if (favicons.length > 0) {
        switch (favicons[0].href.includes("https://")) {
            case true:
                return favicons[0].href;
            case false:
                const baseFaviconUrl =
                    favicons[0].href[0] === "/" ?
                        favicons[0].href.slice(1) :
                        favicons[0].href;

                return `${baseUrl}/${baseFaviconUrl}`;
        }
    } else {
        const baseUrlMetadata = await getMetadataFromBaseUrl(baseUrl);

        if (baseUrlMetadata.favicons.length === 0) return null;

        switch (baseUrlMetadata.favicons[0].href.includes("https://")) {
            case true:
                return baseUrlMetadata.favicons[0].href;
            case false:
                const baseFaviconUrl =
                    baseUrlMetadata.favicons[0].href[0] === "/" ?
                        baseUrlMetadata.favicons[0].href.slice(1) :
                        baseUrlMetadata.favicons[0].href;

                return `${baseUrl}/${baseFaviconUrl}`;
        }
    }
};

const getMetadataImageUrl = async (baseUrl: string, image: string, ogImage: string): Promise<string | null> => {
    if (image.length > 0) return image;
    if (ogImage.length > 0) return ogImage;

    const baseUrlMetadata = await getMetadataFromBaseUrl(baseUrl);

    if (baseUrlMetadata.image.length > 0) return baseUrlMetadata.image;
    if (baseUrlMetadata["og:image"].length > 0) return baseUrlMetadata["og:image"];

    return null;
};