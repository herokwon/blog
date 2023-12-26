import { CalloutBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import { fetchBlocks } from "@/app/lib/databases";
import RichText from "./texts/RichText";
import Block from "./Block";

export default async function Callout({ block }: { block: CalloutBlockObjectResponse }) {
    const children = block.has_children ? await fetchBlocks(block.id) : null;

    return (
        <div className="article-content--callout article-content--indent">
            <RichText richTexts={block.callout.rich_text} />
            {children?.items.map((item, index) =>
                <Block key={index} block={item} blocks={children?.items} index={index} />)}
        </div>
    );
}