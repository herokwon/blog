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

        const title = handleFetchMetadata.title(metadata);
        const description = handleFetchMetadata.description(metadata);
        const baseUrl = url.slice(0, url.indexOf("/", 10));
        const faviconUrl = await handleFetchMetadata.faviconUrl(baseUrl, metadata.favicons);
        const imageUrl = await handleFetchMetadata.imageUrl(baseUrl, metadata);

        return {
            title: title,
            description: description,
            faviconUrl: faviconUrl,
            imageUrl: imageUrl,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(message);
    }
};

const handleFetchMetadata = {
    title: (metadata: UrlMetadata) => {
        if (metadata.title.length > 0) return metadata.title;
        if (metadata["og:title"].length > 0) return metadata["og:title"];
        if (metadata["twitter:title"].length > 0) return metadata["twitter:title"];

        return null;
    },
    description: (metadata: UrlMetadata) => {
        if (metadata.description.length > 0) return metadata.description;
        if (metadata["og:description"].length > 0) return metadata["og:description"];
        if (metadata["twitter:description"].length > 0) return metadata["twitter:description"];

        return null;
    },
    faviconUrl: async (baseUrl: string, favicons: { href: string }[]) => {
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
            const baseUrlMetadata = await handleFetchMetadata.fromBaseUrl(baseUrl);

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
    },
    imageUrl: async (baseUrl: string, metadata: UrlMetadata) => {
        if (metadata.image.length > 0) return metadata.image;
        if (metadata["ogImage"].length > 0) return metadata["ogImage"];
        if (metadata["twitterImage"].length > 0) return metadata["twitterImage"];

        const baseUrlMetadata = await handleFetchMetadata.fromBaseUrl(baseUrl);

        if (baseUrlMetadata.image.length > 0) return baseUrlMetadata.image;
        if (baseUrlMetadata["og:image"].length > 0) return baseUrlMetadata["og:image"];
        if (baseUrlMetadata["twitter:image"].length > 0) return baseUrlMetadata["twitter:image"];

        return null;
    },
    fromBaseUrl: async (baseUrl: string) => {
        const response: unknown = await urlMetadata(baseUrl, {
            mode: "same-origin"
        });

        return response as UrlMetadata;
    },
};