import { ArticleCategoryKeywords, ArticleResponse } from "@/app/types/notion";
import { fetchArticle } from "@/app/lib/databases";
import { extractArticleProperties } from "@/app/lib/functions/notion";
import PageHeader from "@/app/components/PageHeader";
import CategoryButton from "@/app/components/articles/CategoryButton";
import DateTime from "@/app/components/articles/DateTime";

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
            <PageHeader imageSrc={properties.Thumbnail.url ?? ""} title={properties.Title ?? title}>
                <div className="w-full max-w-screen-lg my-4 flex flex-col justify-center items-center absolute bottom-0 left-1/2 -translate-x-1/2 z-[1]">
                    <CategoryButton category={params.category} />
                    <h1 className="py-4 text-center text-dark">{title}</h1>
                    {properties.Date ?
                        <DateTime date={properties.Date} /> :
                        null}
                </div>
            </PageHeader>
            {children}
        </section>
    );
}