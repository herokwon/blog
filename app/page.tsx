import { fetchArticle } from "./lib/databases";
import { ArticleResponse } from "./types/notion";
import { extractArticleProperties } from "./lib/functions/notion";
import Greeting from "./components/intros/Greeting";
import StackViewer from "./components/intros/StackViewer";
import ArticleList from "./components/articles/ArticleList";
import ArticleContainer from "./components/articles/ArticleContainer";
import Section from "./components/Section";

export default async function Home() {
    const response = await fetchArticle({});
    const articleData = new ArticleResponse(response.items, response.nextCursor);

    return (
        <main className="main-wrapper">
            <Section>
                <Greeting />
            </Section>
            <Section wrapperProps={{ className: "bg-light-secondary dark:bg-dark-secondary" }}>
                <StackViewer />
            </Section>
            <Section>
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
            </Section>
        </main>
    );
}