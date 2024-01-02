import { navItem } from "../lib/data/navItem";
import getPageMetadata from "../lib/utils/getPageMetadata";

export const metadata = getPageMetadata({
    path: navItem.at(-1)!.path,
    title: navItem.at(-1)!.title,
    keywords: [navItem.at(-1)!.path.slice(1)],
    imgSrc: "/images/projects.png",
});

export default function Projects() {
    return (
        <>
        </>
    );
}