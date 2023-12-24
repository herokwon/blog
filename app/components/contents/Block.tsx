import { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import Heading from "./Heading";
import Paragraph from "./Paragraph";
import Images from "./Image";
import Quote from "./Quote";

interface BlockProps {
    block: BlockObjectResponse;
    blocks: BlockObjectResponse[];
    index: number;
};

export default async function Block({ block, blocks, index }: BlockProps) {
    switch (block.type) {
        case "audio":
            return null;
        case "bookmark":
            return null;
        case "breadcrumb":
            return null;
        case "bulleted_list_item":
            return null;
        case "callout":
            return null;
        case "child_database":
            return null;
        case "child_page":
            return null;
        case "code":
            return null;
        case "column":
            return null;
        case "column_list":
            return null;
        case "divider":
            return null;
        case "embed":
            return null;
        case "equation":
            return null;
        case "file":
            return null;
        case "heading_1":
            return <Heading block={block} />;
        case "heading_2":
            return <Heading block={block} />;
        case "heading_3":
            return <Heading block={block} />;
        case "image":
            return <Images block={block} />;
        case "link_preview":
            return null;
        case "link_to_page":
            return null;
        case "numbered_list_item":
            return null;
        case "paragraph":
            return <Paragraph block={block} />;
        case "pdf":
            return null;
        case "quote":
            return <Quote block={block} />;
        case "synced_block":
            return null;
        case "table":
            return null;
        case "table_of_contents":
            return null;
        case "table_row":
            return null;
        case "template":
            return null;
        case "to_do":
            return null;
        case "toggle":
            return null;
        case "unsupported":
            return null;
        case "video":
            return null;
    }
}