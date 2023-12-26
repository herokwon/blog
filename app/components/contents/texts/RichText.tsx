import { RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints";

import { extractRichTextStyle } from "@/app/lib/functions/notion";
import { renderKatex } from "@/app/lib/functions/katex";
import CodeText from "./CodeText";
import LinkText from "./LinkText";

export default function RichText({ richTexts }: { richTexts: RichTextItemResponse[] }) {
    return richTexts.map((richText, index) => {
        const code: boolean = richText.annotations.code;
        const href: string | null = richText.href;
        const textStyle = extractRichTextStyle(richText);

        return (
            <CodeText key={index} code={code}>
                <LinkText href={href}>
                    {richText.type === "text" ?
                        <span className={`article-content--text ${textStyle}`}>
                            {richText.text.content}
                        </span> :
                        richText.type === "equation" ?
                            <span className={`article-content--equation ${textStyle}`} dangerouslySetInnerHTML={{ __html: renderKatex(richText.equation.expression) }} /> :
                            <span className={`article-content--mentioin ${textStyle}`} />}
                </LinkText>
            </CodeText>
        );
    });
}