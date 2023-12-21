import { baseUrl } from "@/app/lib/data/api";
import { CategoryResponse } from "@/app/types/notion";

export const generateStaticParams = async () => {
    const response = await fetch(`${baseUrl}/api/database/category`);
    const { categories }: { categories: CategoryResponse } = await response.json();

    return categories;
};

export default function CategoryLayout({ children }: { children: React.ReactNode }) {
    return (
        <main className="main-wrapper">
            {children}
        </main>
    );
}