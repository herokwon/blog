import { Heading1BlockObjectResponse, Heading2BlockObjectResponse, Heading3BlockObjectResponse, RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints";
import Link from "next/link";

import { convertRichToPlain } from "@/app/lib/functions/notion";
import RichText from "./texts/RichText";

type HeadingBlockObjectResponse = Heading1BlockObjectResponse | Heading2BlockObjectResponse | Heading3BlockObjectResponse;

export default function Heading({ block }: { block: HeadingBlockObjectResponse }) {
    const richTexts = block[block.type].rich_text as RichTextItemResponse[];
    const content = convertRichToPlain(richTexts);

    switch (block.type) {
        case "heading_1":
            return <h1 className="article-content--heading" id={content}>
                <Link href={`#${content}`}>
                    <RichText richTexts={richTexts} />
                </Link>
            </h1>;
        case "heading_2":
            return <h2 className="article-content--heading" id={content}>
                <Link href={`#${content}`}>
                    <RichText richTexts={richTexts} />
                </Link>
            </h2>
        case "heading_3":
            return <h3 className="article-content--heading" id={content}>
                <Link href={`#${content}`}>
                    <RichText richTexts={richTexts} />
                </Link>
            </h3>
    }
}