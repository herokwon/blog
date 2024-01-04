import { ArrowDownCircle } from "lucide-react";
import Link from "next/link";

import { fetchArticle } from "./lib/databases";
import { ArticleResponse } from "./types/notion";
import { extractArticleProperties } from "./lib/functions/notion";
import Button from "./components/Button";
import Section from "./components/Section";
import ArticleList from "./components/articles/ArticleList";
import ArticleContainer from "./components/articles/ArticleContainer";

export default async function NotFound() {
    const response = await fetchArticle({});
    const articleData = new ArticleResponse(response.items, response.nextCursor);

    return (
        <main id="notfound" className="main-wrapper py-12 relative">
            <div className="notfound-bg w-full h-full absolute top-0 left-0 overflow-hidden -z-[1]">
                <div className="left-[20%]"></div>
                <div className="left-[40%]"></div>
                <div className="left-[60%]"></div>
                <div className="left-[80%]"></div>
            </div>
            <div className="w-full max-w-screen-lg h-screen px-4 mx-auto flex flex-col justify-center items-center">
                <h2 className="py-2 my-4">페이지를 찾을 수 없습니다.</h2>
                <hr className="w-full border border-[var(--light-foreground)] dark:border-[var(--dark-foreground)]" />
                <p className="py-2 my-4">아래에서 최근에 업로드 된 글을 보실 수 있습니다.</p>
                <Link href="#latest-articles" className="w-fit mx-auto block">
                    <Button innerType="icon" className="box-content">
                        <ArrowDownCircle size={36} />
                    </Button>
                </Link>
            </div>
            <Section wrapperProps={{ id: "latest-articles" }}>
                <ArticleList nextCursor={articleData.nextCursor}>
                    {articleData.items.map((article) => {
                        const properties = extractArticleProperties(article.properties);

                        return (
                            <ArticleContainer
                                key={article.id}
                                id={article.id}
                                Category={properties.Category}
                                Title={properties.Title}
                                Date={properties.Date}
                                Thumbnail={properties.Thumbnail} />
                        );
                    })}
                </ArticleList>
            </Section>
        </main>
    );
}