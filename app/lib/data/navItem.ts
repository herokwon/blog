import { ArticleCategory } from "@/app/types/notion";

interface NavItem {
    path: string;
    title: string;
};

export const navItem: NavItem[] = [
    { path: "/", title: "홈" },
    ...Object.keys(ArticleCategory).map((category: keyof typeof ArticleCategory) => ({ path: `/posts/${category}`, title: ArticleCategory[category] })),
    { path: "/projects", title: "프로젝트" }
];