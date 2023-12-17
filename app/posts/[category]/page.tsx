import { baseUrl } from "@/app/lib/data/api";
import { extractArticleProperties } from "@/app/lib/functions/notion";
import { ArticleResponse } from "@/app/types/notion";
import ArticleContainer from "@/app/components/ArticleContainer";
import ArticleList from "@/app/components/ArticleList";

export default async function Category({ params }: { params: { category: string } }) {
    const response = await fetch(`${baseUrl}/api/database/article?category=${params.category}`, {
        method: "POST",
        body: JSON.stringify({
            nextCursor: null,
        }),
    });

    if (!response.ok) throw new Error(response.statusText);

    const articleResponse: ArticleResponse = await response.json();

    const articleData = new ArticleResponse(articleResponse.items, articleResponse.nextCursor);

    return (
        <section className="section-wrapper">
            <section className="section-container">
                <ArticleList>
                    {articleData.items.map((article) => {
                        const properties = extractArticleProperties(article.properties);

                        return (
                            <ArticleContainer
                                key={article.id}
                                id={article.id}
                                Category={properties.Category}
                                Title={properties.Title}
                                Date={properties.Date}
                                Thumbnail={properties.Thumbnail}
                            />
                        );
                    })}
                </ArticleList>
            </section>
        </section>
    );
}