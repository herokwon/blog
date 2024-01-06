'use server'

import { unfurl } from "unfurl.js";
import { AbsoluteString, AbsoluteTemplateString, DefaultTemplateString } from "next/dist/lib/metadata/types/metadata-types";

import { BookmarkMetadata } from "@/app/types/notion";

// Metadata type (from unfurl.js)
interface UrlMetadata {
    title?: string;
    description?: string;
    keywords?: string[];
    favicon?: string;
    author?: string;
    theme_color?: string;
    canonical_url?: string;
    oEmbed?: {
        type: "photo" | "video" | "link" | "rich";
        width?: number;
        height?: number;
        version?: string;
        title?: string;
        author_name?: string;
        author_url?: string;
        provider_name?: string;
        provider_url?: string;
        cache_age?: number;
        thumbnails?: [
            {
                url?: string;
                width?: number;
                height?: number;
            }
        ];
    };
    twitter_card: {
        card: string;
        site?: string;
        creator?: string;
        creator_id?: string;
        title?: string;
        description?: string;
        players?: {
            url: string;
            stream?: string;
            height?: number;
            width?: number;
        }[];
        apps: {
            iphone: {
                id: string;
                name: string;
                url: string;
            };
            ipad: {
                id: string;
                name: string;
                url: string;
            };
            googleplay: {
                id: string;
                name: string;
                url: string;
            };
        };
        images: {
            url: string;
            alt: string;
        }[];
    };
    open_graph: {
        title: string;
        type: string;
        images?: {
            url: string;
            secure_url?: string;
            type: string;
            width: number;
            height: number;
            alt?: string;
        }[];
        url?: string;
        audio?: {
            url: string;
            secure_url?: string;
            type: string;
        }[];
        description?: string;
        determiner?: string;
        site_name?: string;
        locale: string;
        locale_alt: string;
        videos: {
            url: string;
            stream?: string;
            height?: number;
            width?: number;
            tags?: string[];
        }[];
        article: {
            published_time?: string;
            modified_time?: string;
            expiration_time?: string;
            author?: string;
            section?: string;
            tags?: string[];
        };
    };
};

export const getUrlMetadata = async (url: string): Promise<BookmarkMetadata | null> => {
    try {
        const metadata: UrlMetadata = await unfurl(url, {
            oembed: true,
            timeout: 5000,
            follow: 3,
        });

        const title = handleUrlMetadata.parseTitle(metadata);
        const description = handleUrlMetadata.parseDescription(metadata);
        const faviconUrl = handleUrlMetadata.parseFaviconUrl(metadata);
        const imageUrl = handleUrlMetadata.parseImageData(metadata);

        return {
            title: title,
            description: description,
            faviconUrl: faviconUrl,
            imageUrl: (imageUrl && imageUrl.length > 0) ? imageUrl : null,
        };
    } catch {
        return null;
    }
};

const isString = (s: any): s is string => {
    return typeof s === "string" || s instanceof String;
};

const handleUrlMetadata = {
    parseTitle: (metadata: UrlMetadata): string | null => {
        return metadata.title ? handleUrlMetadata.parseTemplateString(metadata.title) : null;
    },
    parseDescription: (metadata: UrlMetadata): string | null => {
        return metadata.description ?? metadata.open_graph.description ?? metadata.twitter_card.description ?? null;
    },
    parseFaviconUrl: (metadata: UrlMetadata): string | null => {
        return metadata.favicon ?? null;
    },
    parseImageData: (metadata: UrlMetadata): string | null => {
        if (metadata.oEmbed) {
            const thumbnails = metadata.oEmbed.thumbnails;

            if (thumbnails) return thumbnails[0].url ?? null;
        }

        if (metadata.open_graph.images) return metadata.open_graph.images[0].url;

        return metadata.twitter_card.images[0].url;
    },
    parseTemplateString: (str: string | DefaultTemplateString | AbsoluteTemplateString | AbsoluteString): string => {
        if (isString(str)) return str;

        if ('default' in str) return str.default;
        if ('absolute' in str) return str.absolute;
        return "";
    },
};