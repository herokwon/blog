import { BookmarkBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import Link from "next/link";

import { getUrlMetadata } from "@/app/lib/utils/getUrlMetadata";
import Image from "next/image";

export default async function Bookmark({ block }: { block: BookmarkBlockObjectResponse }) {
    const pageUrl = block.bookmark.url;
    const metadata = await getUrlMetadata(pageUrl);

    if (!metadata) return null;

    return (
        <Link
            className="article-content--bookmark"
            target="_blank"
            href={pageUrl}>
            <div className={`article-content--bookmark-info ${metadata.imgData ? "w-2/3 md:w-3/4" : "w-full"} `}>
                {metadata.title ?
                    <h4 className="text-[1.2rem] line-clamp-1">{metadata.title}</h4> : null}
                {metadata.description ?
                    <p className="text-[0.8rem] opacity-off line-clamp-2">{metadata.description}</p> : null}
                <div className="w-full flex items-center">
                    <i className={`${metadata.faviconUrl ? "w-16 h-16 bg-[length:16px_16px] mr-2" : "w-0 h-0"} my-auto block bg-center bg-no-repeat`}
                        style={{
                            backgroundImage:
                                metadata.faviconUrl ?
                                    `url(${metadata.faviconUrl})` : undefined
                        }} />
                    <span className="text-[0.9rem] line-clamp-1">{pageUrl}</span>
                </div>
            </div>
            <div className={`article-content--bookmark-image ${metadata.imgData ? "w-1/3 md:w-1/4 h-full" : "w-0 h-0"}`}>
                {metadata.imgData ?
                    <Image
                        src={metadata.imgData.url}
                        fill
                        sizes="(max-width: 768px) 33vw (max-width: 1056px) 25vw 256px"
                        unoptimized
                        placeholder="blur"
                        blurDataURL={metadata.imgData.base64}
                        className="object-cover object-center"
                        alt="bookmark-image" /> : null}
            </div>
        </Link>
    );
}