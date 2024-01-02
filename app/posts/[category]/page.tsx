import { ArticleCategory, ArticleCategoryKeywords, ArticleResponse } from "@/app/types/notion";
import { CategoryHeader } from "@/app/lib/data/constants";
import { fetchArticle } from "@/app/lib/databases";
import { extractArticleProperties } from "@/app/lib/functions/notion";
import getPageMetadata from "@/app/lib/utils/getPageMetadata";
import PageHeader from "@/app/components/PageHeader";
import ArticleContainer from "@/app/components/articles/ArticleContainer";
import ArticleList from "@/app/components/articles/ArticleList";
import Section from "@/app/components/Section";

export const generateMetadata = ({ params }: { params: { category: ArticleCategoryKeywords } }) => {
    return getPageMetadata({
        path: `/posts/${params.category}`,
        title: ArticleCategory[params.category],
        keywords: [params.category],
        imgSrc: `/images/${params.category}.png`,
    });
};

export default async function Category({ params }: { params: { category: ArticleCategoryKeywords } }) {
    const response = await fetchArticle({ category: params.category });
    const articleData = new ArticleResponse(response.items, response.nextCursor);

    return (
        <>
            <PageHeader imageSrc={CategoryHeader[params.category]}>
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