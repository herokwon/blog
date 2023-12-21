import { ArticleCategory } from "@/app/types/notion";

interface ContentLayoutProps {
    params: {
        category: keyof typeof ArticleCategory;
        title: string;
    };
    children: React.ReactNode;
};

export default function ContentLayout({ params, children }: ContentLayoutProps) {
    return (
        <section className="main-wrapper">
            {children}
        </section>
    );
}