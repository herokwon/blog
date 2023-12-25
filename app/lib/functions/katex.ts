import katex from "katex";

export const renderKatex = (content: string) => {
    return katex.renderToString(content, { output: "mathml" });
};