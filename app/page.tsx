import { fetchArticle } from "./lib/databases";
import { ArticleResponse } from "./types/notion";
import { extractArticleProperties } from "./lib/functions/notion";
import Greeting from "./components/intros/Greeting";
import StackViewer from "./components/intros/StackViewer";
import ArticleList from "./components/articles/ArticleList";
import ArticleContainer from "./components/articles/ArticleContainer";

export default async function Home() {
    const response = await fetchArticle({});
    const articleData = new ArticleResponse(response.items, response.nextCursor);

    return (
        <main className="main-wrapper">
            <section className="section-wrapper">
                <Greeting />
            </section>
            <section className="section-wrapper">
                <StackViewer />
            </section>
            <section className="section-wrapper">
                <section className="section-container">
                    <h2 className="text-center">모든 글</h2>
                    <ArticleList
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
        </main>
    );
}