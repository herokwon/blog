import { EmbedBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import RichText from "./texts/RichText";

export default function Embed({ block }: { block: EmbedBlockObjectResponse }) {
    return (
        <div className="w-full my-block relative">
            {<iframe
                className="article-content--embed"
                src={block.embed.url} />}
            <div className="article-content--caption">
                <RichText richTexts={block.embed.caption} />
            </div>
        </div>
    );
}