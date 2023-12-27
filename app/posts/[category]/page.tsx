import { ArticleCategory, ArticleCategoryKeywords, ArticleResponse } from "@/app/types/notion";
import { fetchArticle } from "@/app/lib/databases";
import { extractArticleProperties } from "@/app/lib/functions/notion";
import PageHeader from "@/app/components/PageHeader";
import ArticleContainer from "@/app/components/articles/ArticleContainer";
import ArticleList from "@/app/components/articles/ArticleList";

export default async function Category({ params }: { params: { category: ArticleCategoryKeywords } }) {
    const response = await fetchArticle({ category: params.category });
    const articleData = new ArticleResponse(response.items, response.nextCursor);

    return (
        <>
            <PageHeader imageUrl={`/images/${params.category}.png`}>
                <div className="w-full my-4 absolute bottom-0 left-0 z-[1]">
                    <h1 className="text-center text-dark">{ArticleCategory[params.category]}</h1>
                </div>
            </PageHeader>
            <section className="section-wrapper">
                <section className="section-container">
                    <ArticleList
                        category={params.category}
                        nextCursor={articleData.nextCursor}>
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
        </>
    );
}