import { Metadata } from "next";

import { AUTHOR, BASE_URL } from "../data/constants";

interface PageMetadata {
    path: string;
    title?: string;
    description?: string;
    keywords?: string[];
    imgSrc?: string;
};

const getPageMetadata = ({ path, title, description, keywords, imgSrc }: PageMetadata): Metadata => {
    const pageUrl = `${BASE_URL}${path}`;
    const pageTitle = title ?
        `${title} | All of IT` : "All of IT";
    const pageDescription = description ?? "배움과 성장을 기록하는 공간 | Hero Kwon's Blog";
    const imgUrl = imgSrc?.includes("https://") ?
        imgSrc : `${BASE_URL}${imgSrc ?? "/images/opengraph.png"}`;

    return {
        authors: [{ name: AUTHOR, url: BASE_URL }],
        creator: AUTHOR,
        title: pageTitle,
        description: pageDescription,
        keywords: ['blog', 'programming', 'programmer', 'developer', 'dev', 'web-dev', 'app-dev', 'front-end', ...(keywords ?? [])],
        openGraph: {
            title: pageTitle,
            type: "website",
            description: pageDescription,
            url: pageUrl,
            images: imgUrl,
            locale: "ko_KR",
            ttl: path.includes("/posts") ?
                86400 : 432000,  // 1day : 5days
        },
        twitter: {
            card: "summary",
            creator: AUTHOR,
            title: pageTitle,
            description: pageDescription,
            site: pageUrl,
            images: imgUrl,
        },
    };
};

export default getPageMetadata;