import { baseUrl } from "@/app/lib/data/api";
import { ArticleCategory } from "@/app/lib/data/notion";
import { CategoryResponse } from "@/app/types/notion";
import PageHeader from "@/app/components/PageHeader";
import Image from "next/image";
import { getTheme } from "@/app/lib/functions/theme";

export const generateStaticParams = async () => {
    const response = await fetch(`${baseUrl}/api/database/category`);
    const { categories }: { categories: CategoryResponse } = await response.json();

    return categories;
};

export default function CategoryLayout({ params, children }: { params: { category: string }; children: React.ReactNode }) {
    return (
        <main className="main-wrapper">
            <PageHeader title={ArticleCategory[params.category]}>
                <Image src={`/images/${params.category}.png`} fill sizes="1x" className="object-cover object-center opacity-25" alt="header-image" />
            </PageHeader>
            {children}
        </main>
    );
}