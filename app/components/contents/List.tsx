import { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import { ListItemBlockObjectResponse, ListItemBlock } from "@/app/types/notion";
import { fetchBlocks } from "@/app/lib/databases";
import RichText from "./texts/RichText";
import Block from "./Block";

export default function List({ block, blocks, index }: { block: ListItemBlockObjectResponse; blocks: BlockObjectResponse[]; index: number }) {
    const listItems = mergeAdjacentListItems(block, blocks, index);

    if (block.type === blocks[index - 1].type) return null;

    switch (block.type) {
        case "bulleted_list_item":
            return (
                <ul className="article-content--list-bulleted">
                    {listItems.map(async (itemBlock: ListItemBlock<string>, index) => {
                        const children = itemBlock.has_children ? await fetchBlocks(itemBlock.id) : null;

                        return (
                            <li key={index}>
                                <RichText richTexts={itemBlock.bulleted_list_item.rich_text} />
                                {children?.items.map((item, index) =>
                                    <Block
                                        key={index}
                                        block={item}
                                        blocks={children?.items}
                                        index={index} />)}
                            </li>
                        );
                    })}
                </ul>
            );
        case "numbered_list_item":
            return (
                <ol className="article-content--list-numbered">
                    {listItems.map(async (itemBlock: ListItemBlock<number>, index) => {
                        const children = itemBlock.has_children ? await fetchBlocks(itemBlock.id) : null;

                        return (
                            <li key={index}>
                                <RichText richTexts={itemBlock.numbered_list_item.rich_text} />
                                {children?.items.map((item, index) =>
                                    <Block
                                        key={index}
                                        block={item}
                                        blocks={children?.items}
                                        index={index} />)}
                            </li>
                        );
                    })}
                </ol>
            );
    }
}

const mergeAdjacentListItems = (block: ListItemBlockObjectResponse, blocks: BlockObjectResponse[], index: number) => {
    const listItems: ListItemBlockObjectResponse[] = [];

    for (let i = index; i < blocks.length; i++) {
        if (blocks[i].type === block.type) listItems.push(blocks[i] as ListItemBlockObjectResponse);
        else break;
    }

    return listItems;
};