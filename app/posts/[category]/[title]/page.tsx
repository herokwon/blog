import { ArticleCategoryKeywords, ArticleResponse } from "@/app/types/notion";
import { fetchArticle } from "@/app/lib/databases";
import Section from "@/app/components/Section";
import ArticleContent from "@/app/components/articles/ArticleContent";

export default async function ContentPage({ params }: { params: { category: ArticleCategoryKeywords; title: string; } }) {
    const response = await fetchArticle({ title: decodeURIComponent(params.title) });
    const articleData = new ArticleResponse(response.items, response.nextCursor);

    return (
        <Section>
            <ArticleContent id={articleData.items[0].id} />
        </Section>
    );
}