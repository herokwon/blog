import { BlockResponse } from "@/app/types/notion";
import { fetchBlocks } from "@/app/lib/databases";
import Block from "../contents/Block";
import Toc from "../Toc";
import { extractHeadings } from "@/app/lib/functions/notion";

export default async function ArticleContent({ id }: { id: string }) {
    const response = await fetchBlocks(id);
    const blockData = new BlockResponse(response.items, response.nextCursor);
    const headings = extractHeadings(blockData.items);

    return (
        <article className="article-content">
            {blockData.items.map((block, index) =>
                <Block
                    key={index}
                    block={block}
                    blocks={blockData.items}
                    index={index} />
            )}
            <Toc headings={headings} />
        </article>
    );
}