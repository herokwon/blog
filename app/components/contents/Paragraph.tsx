import { ParagraphBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import { fetchBlocks } from "@/app/lib/databases";
import RichText from "./texts/RichText";
import Block from "./Block";

export default async function Paragraph({ block }: { block: ParagraphBlockObjectResponse }) {
    const children = block.has_children ? await fetchBlocks(block.id) : null;

    return (
        <p className="article-content--paragraph">
            <RichText richTexts={block.paragraph.rich_text} />
            {!children ?
                null :
                <p className="article-content--indent">
                    {children.items.map((item, index) =>
                        <Block
                            key={item.id}
                            block={item}
                            blocks={children.items}
                            index={index} />)}
                </p>}
        </p>
    );
}