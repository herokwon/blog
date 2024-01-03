import { ListItemBlock, ListItemBlockObjectResponse } from "@/app/types/notion";
import { fetchBlocks } from "@/app/lib/databases";
import RichText from "./texts/RichText";
import Block from "./Block";

export default async function ListItem({ listItem, itemType }: { listItem: ListItemBlockObjectResponse; itemType: "string" | "number" }) {
    const children = listItem.has_children ? await fetchBlocks(listItem.id) : null;

    switch (itemType) {
        case "string":
            const bulletedListItem = listItem as ListItemBlock<string>;

            return (<li>
                <RichText richTexts={bulletedListItem.bulleted_list_item.rich_text} />
                {children?.items.map((item, index) =>
                    <Block
                        key={index}
                        block={item}
                        blocks={children?.items}
                        index={index} />)}
            </li>);
        case "number":
            const numberListItem = listItem as ListItemBlock<number>;

            return (<li>
                <RichText richTexts={numberListItem.numbered_list_item.rich_text} />
                {children?.items.map((item, index) =>
                    <Block
                        key={index}
                        block={item}
                        blocks={children?.items}
                        index={index} />)}
            </li>);
    }
}