export interface UrlMetadata {
    url: string;
    title: string;
    image: string;
    favicons: {
        type: string | undefined;
        href: string;
        sizes: string | undefined;
    }[];
    description: string;
    jsonld: {
        image: string[];
    } | {
        image: {
            url: string;
        };
    }[];
};