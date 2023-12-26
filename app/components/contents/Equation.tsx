import { EquationBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import { renderKatex } from "@/app/lib/functions/katex";

export default function Equation({ block }: { block: EquationBlockObjectResponse }) {
    const katexHtml = renderKatex(block.equation.expression);

    return (
        <div className="article-content--equation" dangerouslySetInnerHTML={{ __html: katexHtml }} />
    );
}