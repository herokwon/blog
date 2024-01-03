import { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import { ListItemBlockObjectResponse } from "@/app/types/notion";
import ListItem from "./ListItem";

export default function List({ block, blocks, index }: { block: ListItemBlockObjectResponse; blocks: BlockObjectResponse[]; index: number }) {
    const listItems = mergeAdjacentListItems(block, blocks, index);

    if (block.type === blocks[index - 1]?.type ?? null) return null;

    switch (block.type) {
        case "bulleted_list_item":
            return (
                <ul className="article-content--list-bulleted">
                    {listItems.map((listItem, index) =>
                        <ListItem
                            key={index}
                            listItem={listItem}
                            itemType="string" />
                    )}
                </ul>
            );
        case "numbered_list_item":
            return (
                <ol className="article-content--list-numbered">
                    {listItems.map((listItem, index) =>
                        <ListItem
                            key={index}
                            listItem={listItem}
                            itemType="number" />
                    )}
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