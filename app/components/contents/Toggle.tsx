import { ToggleBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import { fetchBlocks } from "@/app/lib/databases";
import RichText from "./RichText";
import Block from "./Block";

export default async function Toggle({ block }: { block: ToggleBlockObjectResponse }) {
    const children = block.has_children ? await fetchBlocks(block.id) : null;

    return (
        <details className="article-content--toggle">
            <summary className="max-w-max cursor-pointer">
                <RichText richTexts={block.toggle.rich_text} />
            </summary>
            <div className="pl-4">
                {children?.items.map((item, index) =>
                    <Block
                        key={index}
                        block={item}
                        blocks={children?.items}
                        index={index} />)}
            </div>
        </details>
    );
}