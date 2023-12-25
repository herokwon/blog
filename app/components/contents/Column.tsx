import { ColumnBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import { fetchBlocks } from "@/app/lib/databases";
import Block from "./Block";

export default async function Column({ block }: { block: ColumnBlockObjectResponse }) {
    const children = block.has_children ? await fetchBlocks(block.id) : null;

    return (
        <div className="article-content--column">
            {children?.items.map((item, index) =>
                <Block key={index} block={item} blocks={children?.items} index={index} />)}
        </div>
    );
}