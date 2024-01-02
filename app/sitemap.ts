import { MetadataRoute } from "next";

import { navItem } from "./lib/data/navItem";
import { BASE_URL } from "./lib/data/constants";

export default function Sitemap(): MetadataRoute.Sitemap {
    return navItem.map((item) => ({
        url: `${BASE_URL}${item.path}`,
        lastModified: new Date(),
        changeFrequency:
            item.path.includes("/posts") ?
                'daily' : 'weekly',
    }));
};