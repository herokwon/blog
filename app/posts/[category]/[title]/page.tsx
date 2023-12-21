import { notFound } from "next/navigation";
import { baseUrl } from "@/app/lib/data/api";
import { ArticleCategory, ArticleResponse } from "@/app/types/notion";

export default async function ContentPage({ params }: { params: { category: keyof typeof ArticleCategory; title: string; } }) {
    const response = await fetch(`${baseUrl}/api/database/article`, {
        method: "POST",
        body: JSON.stringify({
            title: decodeURIComponent(params.title),
        }),
    });

    if (!response.ok) notFound();

    const articleResponse: ArticleResponse = await response.json();
    const articleData = new ArticleResponse(articleResponse.items, null);

    return (
        <section className="section-wrapper">
            <article className="section-container">
            </article>
        </section>
    );
}