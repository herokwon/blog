'use client'

import { useEffect, useRef } from "react";
import { CodeBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { highlightAll } from "prismjs";
import dynamic from "next/dynamic";
import "prismjs/themes/prism-okaidia.css";

import { convertRichToPlain } from "@/app/lib/functions/notion";

const CodeBlock = ({ block }: { block: CodeBlockObjectResponse }) => {
    const codeRef = useRef(null);
    const language = block.code.language;
    const content = convertRichToPlain(block.code.rich_text);

    useEffect(() => {
        if (codeRef.current) {
            highlightAll(codeRef.current);
        }
    }, [codeRef]);

    return (
        <pre className={`article-content--code language-${language}`}>
            <code ref={codeRef}>
                {content}
            </code>
        </pre>
    );
}

const Code = dynamic(() => import("@/app/lib/data/prism").then(() => CodeBlock));

export default Code;