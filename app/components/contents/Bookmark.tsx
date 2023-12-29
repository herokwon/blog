import { BookmarkBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { getMetadata } from "@/app/lib/utils/getMetadata";
import Link from "next/link";

export default async function Bookmark({ block }: { block: BookmarkBlockObjectResponse }) {
    const metadata = await getMetadata(block.bookmark.url);

    return (
        <Link
            className="article-content--bookmark group"
            target="_blank"
            href={metadata.pageUrl}>
            <div className="w-2/3 md:w-3/4 h-full px-3 py-1.5 flex flex-col justify-between bg-inherit group-hover:bg-light-tertiary dark:group-hover:bg-dark-tertiary transition-all duration-200">
                <h4 className="text-[1.2rem] line-clamp-1">{metadata.title}</h4>
                <p className="text-[0.8rem] opacity-off line-clamp-2">{metadata.description}</p>
                <div className="w-full flex items-center">
                    <i className="w-16 h-16 mr-2 my-auto block bg-center bg-no-repeat bg-[length:16px_16px]" style={{ backgroundImage: `url(${metadata.faviconUrl})` }} />
                    <span className="text-[0.9rem] line-clamp-1">{metadata.pageUrl}</span>
                </div>
            </div>
            <div className="w-1/3 md:w-1/4 h-full opacity-bold dark:opacity-off dark:group-hover:opacity-bold bg-center bg-no-repeat bg-[length:384px_384px] transition-all duration-200 relative"
                style={{ backgroundImage: `url(${metadata.imageUrl})` }} />
        </Link>
    );
}