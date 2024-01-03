import { BlockResponse } from "@/app/types/notion";
import { fetchBlocks } from "@/app/lib/databases";
import Block from "../contents/Block";

export default async function ArticleContent({ id }: { id: string }) {
    const response = await fetchBlocks(id);
    const blockData = new BlockResponse(response.items, response.nextCursor);

    return (
        <article className="article-content">
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