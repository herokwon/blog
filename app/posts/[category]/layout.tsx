import { fetchAllCategories } from "@/app/lib/databases/category";

export const generateStaticParams = async () => {
    const { categories } = await fetchAllCategories();
    return categories;
};

export default function CategoryLayout({ children }: { children: React.ReactNode }) {
    return (
        <main className="main-wrapper">
            {children}
        </main>
    );
}