import { baseUrl } from "@/app/lib/data/api";
import { ArticleResponse } from "@/app/types/notion";
import { extractArticleProperties } from "@/app/lib/functions/notion";
import ArticleContainer from "@/app/components/articles/ArticleContainer";
import ArticleList from "@/app/components/articles/ArticleList";

export default async function Category({ params }: { params: { category: string } }) {
    const fetchUrl: RequestInfo = `${baseUrl}/api/database/article?category=${params.category}`;

    const response = await fetch(fetchUrl, {
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
                <ArticleList fetchUrl={fetchUrl} nextCursor={articleData.nextCursor}>
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