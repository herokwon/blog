import { ArticleCategoryKeywords, ArticleResponse } from "@/app/types/notion";
import { fetchArticle } from "@/app/lib/databases";
import { extractArticleProperties } from "@/app/lib/functions/notion";
import { getDate } from "@/app/lib/utils/getDate";
import PageHeader from "@/app/components/PageHeader";
import CategoryButton from "@/app/components/articles/CategoryButton";

interface ContentLayoutProps {
    params: {
        category: ArticleCategoryKeywords;
        title: string;
    };
    children: React.ReactNode;
};

export default async function ContentLayout({ params, children }: ContentLayoutProps) {
    const title = decodeURIComponent(params.title);

    const response = await fetchArticle({ title: title });
    const articleData = new ArticleResponse(response.items, response.nextCursor);

    const properties = extractArticleProperties(articleData.items[0].properties);

    return (
        <section className="main-wrapper">
            <PageHeader imageUrl={properties.Thumbnail.url ?? ""} title={properties.Title ?? title}>
                <div className="w-full my-4 flex flex-col justify-center items-center absolute bottom-0 left-0 z-[1]">
                    <CategoryButton category={params.category} />
                    <h1 className="py-4 text-center text-dark">{title}</h1>
                    {properties.Date ?
                        <span className="text-[0.72rem]">{getDate(properties.Date)}</span> :
                        null}
                </div>
            </PageHeader>
            {children}
        </section>
    );
}