import { StaticImport } from "next/dist/shared/lib/get-img-props";

import { ArticleCategory, ArticleCategoryKeywords, ArticleResponse } from "@/app/types/notion";
import { fetchArticle } from "@/app/lib/databases";
import { extractArticleProperties } from "@/app/lib/functions/notion";
import PageHeader from "@/app/components/PageHeader";
import ArticleContainer from "@/app/components/articles/ArticleContainer";
import ArticleList from "@/app/components/articles/ArticleList";

import DevImage from "@/public/images/dev.png";
import RetrospectImage from "@/public/images/retrospect.png";
import StudyImage from "@/public/images/study.png";
import ColumnImage from "@/public/images/column.png";
import LifeImage from "@/public/images/life.png";
import Section from "@/app/components/Section";

const importImage: { [key in ArticleCategoryKeywords]: StaticImport } = {
    dev: DevImage,
    retrospect: RetrospectImage,
    study: StudyImage,
    column: ColumnImage,
    life: LifeImage,
};

export default async function Category({ params }: { params: { category: ArticleCategoryKeywords } }) {
    const response = await fetchArticle({ category: params.category });
    const articleData = new ArticleResponse(response.items, response.nextCursor);

    return (
        <>
            <PageHeader imageSrc={importImage[params.category]}>
                <div className="w-full my-4 absolute bottom-0 left-0 z-[1]">
                    <h1 className="text-center text-dark">{ArticleCategory[params.category]}</h1>
                </div>
            </PageHeader>
            <Section>
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
            </Section>
        </>
    );
}