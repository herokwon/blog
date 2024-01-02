import { MetadataRoute } from "next";

import { BASE_URL } from "./lib/data/constants";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
        },
        sitemap: `${BASE_URL}/sitemap.xml`
    };
}