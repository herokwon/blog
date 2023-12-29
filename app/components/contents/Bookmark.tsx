import { BookmarkBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import Link from "next/link";

export default function Bookmark({ block }: { block: BookmarkBlockObjectResponse }) {
    return (
        <Link
            className="article-content--bookmark"
            target="_blank"
            href={block.bookmark.url}>
        </Link>
    );
}