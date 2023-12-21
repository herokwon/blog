import { notFound } from "next/navigation";
import { baseUrl } from "@/app/lib/data/api";
import { ArticleCategory, ArticleResponse } from "@/app/types/notion";
import ArticleContent from "@/app/components/articles/ArticleContent";

export default async function ContentPage({ params }: { params: { category: keyof typeof ArticleCategory; title: string; } }) {
    const response = await fetch(`${baseUrl}/api/database/article?title=${decodeURIComponent(params.title)}`, {
        method: "POST",
        body: JSON.stringify({
            nextCursor: null,
        }),
    });

    if (!response.ok) notFound();

    const articleResponse: ArticleResponse = await response.json();
    const articleData = new ArticleResponse(articleResponse.items, null);

    return (
        <section className="section-wrapper">
            <ArticleContent id={articleData.items[0].id} />
        </section>
    );
}