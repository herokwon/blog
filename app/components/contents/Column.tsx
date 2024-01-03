import { ColumnBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import { fetchBlocks } from "@/app/lib/databases";
import Block from "./Block";

export default async function Column({ block }: { block: ColumnBlockObjectResponse }) {
    const children = block.has_children ? await fetchBlocks(block.id) : null;

    return (
        <div className="article-content--column" style={{
            gridTemplateColumns: "minmax(0, 1fr)",
            gridTemplateRows: `repeat(${children?.items.length}, minmax(0, 1fr))`
        }}>
            {children?.items.map((item, index) =>
                <Block key={index} block={item} blocks={children?.items} index={index} />)}
        </div>
    );
}