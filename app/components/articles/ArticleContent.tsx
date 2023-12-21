import { baseUrl } from "@/app/lib/data/api";
import { BlockResponse } from "@/app/types/notion";
import Block from "../contents/Block";

export default async function ArticleContent({ id }: { id: string }) {
    const blockData = new BlockResponse([], null);

    do {
        const response = await fetch(`${baseUrl}/api/database/article/blocks`, {
            method: "POST",
            body: JSON.stringify({
                pageId: id,
            }),
        });

        const blockResponse: BlockResponse = await response.json();
        blockData.items.push(...blockResponse.items);
        blockData.nextCursor = blockResponse.nextCursor;
    } while (blockData.nextCursor);

    return (
        <article className="article-content section-container">
            {blockData.items.map((block, index) =>
                <Block
                    key={index}
                    block={block}
                    blocks={blockData.items}
                    index={index} />
            )}
        </article>
    );
}