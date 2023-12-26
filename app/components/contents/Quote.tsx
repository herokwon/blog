import { QuoteBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import { fetchBlocks } from "@/app/lib/databases";
import RichText from "./texts/RichText";
import Block from "./Block";

export default async function Quote({ block }: { block: QuoteBlockObjectResponse }) {
    const children = block.has_children ? await fetchBlocks(block.id) : null;

    return (
        <div className="article-content--quote">
            <RichText richTexts={block.quote.rich_text} />
            {children?.items.map((item, index) =>
                <div className="article-content--indent" key={index}>
                    <Block
                        block={item}
                        blocks={children?.items}
                        index={index} />
                </div>)}
        </div>
    );
}