import { ArticleCategory, ArticleResponse } from "@/app/types/notion";
import { fetchArticle } from "@/app/lib/databases";
import ArticleContent from "@/app/components/articles/ArticleContent";

export default async function ContentPage({ params }: { params: { category: keyof typeof ArticleCategory; title: string; } }) {
    const response = await fetchArticle({ title: decodeURIComponent(params.title) });
    const articleData = new ArticleResponse(response.items, response.nextCursor);

    return (
        <section className="section-wrapper">
            <ArticleContent id={articleData.items[0].id} />
        </section>
    );
}