import { EmbedBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import RichText from "./texts/RichText";

export default function Embed({ block }: { block: EmbedBlockObjectResponse }) {
    return (
        <div className="w-full my-block relative">
            <iframe src={block.embed.url} className="article-content--embed" />
            <div className="article-content--caption">
                <RichText richTexts={block.embed.caption} />
            </div>
        </div>
    );
}