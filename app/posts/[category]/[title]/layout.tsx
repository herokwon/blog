import PageHeader from "@/app/components/PageHeader";
import CategoryButton from "@/app/components/articles/CategoryButton";
import { notFound } from "next/navigation";
import { baseUrl } from "@/app/lib/data/api";
import { extractArticleProperties } from "@/app/lib/functions/notion";
import { ArticleCategory, ArticleResponse } from "@/app/types/notion";

interface ContentLayoutProps {
    params: {
        category: keyof typeof ArticleCategory;
        title: string;
    };
    children: React.ReactNode;
};

export default async function ContentLayout({ params, children }: ContentLayoutProps) {
    const response = await fetch(`${baseUrl}/api/database/article?title=${params.title}`, {
        method: "POST",
        body: JSON.stringify({
            nextCursor: null,
        }),
    });

    if (!response.ok) notFound();

    const articleResponse: ArticleResponse = await response.json();
    const articleData = new ArticleResponse(articleResponse.items, null);

    const properties = extractArticleProperties(articleData.items[0].properties);

    return (
        <section className="main-wrapper">
            <PageHeader imageUrl={properties.Thumbnail.url} title={properties.Title ?? decodeURIComponent(params.title)}>
                <div className="w-full my-4 flex flex-col justify-center items-center absolute bottom-0 left-0 z-[1]">
                    <CategoryButton category={params.category} />
                    <h1 className="text-center text-dark">{decodeURIComponent(params.title)}</h1>
                </div>
            </PageHeader>
            {children}
        </section>
    );
}