import { ArticleCategoryKeywords, ArticleResponse } from "@/app/types/notion";
import { fetchArticle } from "@/app/lib/databases";
import { extractArticleProperties } from "@/app/lib/functions/notion";
import getPageMetadata from "@/app/lib/utils/getPageMetadata";
import Section from "@/app/components/Section";
import ArticleContent from "@/app/components/articles/ArticleContent";

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
    const response = await fetchArticle({
        category: params.category, title: decodeURIComponent(params.title)
    });
    const articleData = new ArticleResponse(response.items, response.nextCursor);

    return (
        <Section>
            <ArticleContent id={articleData.items[0].id} />
        </Section>
    );
}