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
    'og:title': string;
    'og:description': string;
    'og:image': string;
    'twitter:title': string;
    'twitter:description': string;
    'twitter:image': string;
};