import { notFound } from "next/navigation";

import { ArticleCategoryKeywords, ArticleResponse, BlockResponse } from "@/app/types/notion";
import { fetchArticle, fetchBlocks } from "@/app/lib/databases";
import { extractArticleProperties, extractHeadings } from "@/app/lib/functions/notion";
import getPageMetadata from "@/app/lib/utils/getPageMetadata";
import Section from "@/app/components/Section";
import ArticleContent from "@/app/components/articles/ArticleContent";
import Block from "@/app/components/contents/Block";

export const generateMetadata = async ({ params }: { params: { category: ArticleCategoryKeywords; title: string; } }) => {
    const response = await fetchArticle({
        category: params.category, title: decodeURIComponent(params.title)
    });
    const articleData = new ArticleResponse(response.items, response.nextCursor);
    const properties = articleData.length() === 0 ?
        null : extractArticleProperties(articleData.items[0].properties);

    return getPageMetadata({
        path: `/posts/${params.category}/${params.title}`,
        title: decodeURIComponent(params.title),
        description: properties?.Description ?? undefined,
        keywords: [params.category, ...(properties?.Tag.map((tag) => tag.name) ?? [])],
        imgSrc: properties?.Thumbnail?.url ?? undefined,
    });
};

export default async function ContentPage({ params }: { params: { category: ArticleCategoryKeywords; title: string; } }) {
    const articleResponse = await fetchArticle({
        category: params.category, title: decodeURIComponent(params.title)
    });
    const articleData = new ArticleResponse(articleResponse.items, articleResponse.nextCursor);

    if (articleData.length() !== 1) notFound();

    const article = articleData.items[0];

    const blockResponse = await fetchBlocks(article.id);
    const blockData = new BlockResponse(blockResponse.items, blockResponse.nextCursor);

    const headings = extractHeadings(blockData.items);

    return (
        <Section>
            <ArticleContent headings={headings}>
                {blockData.items.map((block, index) =>
                    <Block
                        key={index}
                        block={block}
                        blocks={blockData.items}
                        index={index} />
                )}
            </ArticleContent>
        </Section>
    );
}