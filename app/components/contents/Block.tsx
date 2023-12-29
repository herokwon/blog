import { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import { getImage } from "@/app/lib/functions/notion";
import getImageMetadata from "@/app/lib/utils/getImageMetadata";
import Heading from "./Heading";
import Paragraph from "./Paragraph";
import Quote from "./Quote";
import Code from "./Code";
import Callout from "./Callout";
import ColumnList from "./columns/ColumnList";
import Column from "./columns/Column";
import Equation from "./Equation";
import List from "./List";
import Toggle from "./Toggle";
import Table from "./tables/Table";
import Images from "./Image";
import Video from "./Video";
import Pdf from "./Pdf";
import Embed from "./Embed";
import Divider from "./Divider";
import ToDo from "./ToDo";
import Bookmark from "./Bookmark";

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
            return <Bookmark block={block} />;
        case "breadcrumb":
            return null;
        case "bulleted_list_item":
            return (
                <List
                    block={block}
                    blocks={blocks}
                    index={index} />
            );
        case "callout":
            return <Callout block={block} />
        case "child_database":
            return null;
        case "child_page":
            return null;
        case "code":
            return <Code block={block} />
        case "column":
            return <Column block={block} />
        case "column_list":
            return <ColumnList block={block} />
        case "divider":
            return <Divider />;
        case "embed":
            return <Embed block={block} />;
        case "equation":
            return <Equation block={block} />
        case "file":
            return null;
        case "heading_1":
            return <Heading block={block} />
        case "heading_2":
            return <Heading block={block} />
        case "heading_3":
            return <Heading block={block} />
        case "image":
            const imgData = getImage(block);
            const imgMetadata = await getImageMetadata(imgData.url);
            return (
                <Images
                    block={block}
                    imgData={imgData}
                    imgMetadata={imgMetadata} />
            );
        case "link_preview":
            return null;
        case "link_to_page":
            return null;
        case "numbered_list_item":
            return (
                <List
                    block={block}
                    blocks={blocks}
                    index={index} />
            );
        case "paragraph":
            return <Paragraph block={block} />
        case "pdf":
            return <Pdf block={block} />;
        case "quote":
            return <Quote block={block} />
        case "synced_block":
            return null;
        case "table":
            return <Table block={block} />;
        case "table_of_contents":
            return null;
        case "table_row":
            return null;
        case "template":
            return null;
        case "to_do":
            return <ToDo block={block} />
        case "toggle":
            return <Toggle block={block} />;
        case "unsupported":
            return null;
        case "video":
            return <Video block={block} />;
    }
}