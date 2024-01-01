import { BookmarkBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import { getMetadata } from "@/app/lib/utils/getMetadata";
import Link from "next/link";

export default async function Bookmark({ block }: { block: BookmarkBlockObjectResponse }) {
    const pageUrl = block.bookmark.url;
    const metadata = await getMetadata(pageUrl);

    return (
        <Link
            className="article-content--bookmark"
            target="_blank"
            href={pageUrl}>
            <div className={`article-content--bookmark-info ${metadata.imageUrl ? "w-2/3 md:w-3/4" : "w-full"} `}>
                {metadata.title ?
                    <h4 className="text-[1.2rem] line-clamp-1">{metadata.title}</h4> :
                    null}
                {metadata.description ?
                    <p className="text-[0.8rem] opacity-off line-clamp-2">{metadata.description}</p> :
                    null}
                <div className="w-full flex items-center">
                    <i className={`${metadata.faviconUrl ? "w-16 h-16 bg-[length:16px_16px]" : "w-0 h-0"} mr-2 my-auto block bg-center bg-no-repeat`}
                        style={{
                            backgroundImage:
                                metadata.faviconUrl ?
                                    `url(${metadata.faviconUrl})` :
                                    undefined
                        }} />
                    <span className="text-[0.9rem] line-clamp-1">{pageUrl}</span>
                </div>
            </div>
            <div className={`article-content--bookmark-image ${metadata.imageUrl ? "w-1/3 md:w-1/4 bg-[length:384px_192px]" : "w-0 h-0"}`}
                style={{
                    backgroundImage:
                        metadata.imageUrl ?
                            `url(${metadata.imageUrl})` :
                            undefined
                }} />
        </Link>
    );
}