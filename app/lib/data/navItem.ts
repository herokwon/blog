import { ArticleCategory, ArticleCategoryKeywords } from "@/app/types/notion";

interface NavItem {
    path: string;
    title: string;
};

export const navItem: NavItem[] = [
    { path: "/", title: "홈" },
    ...Object.keys(ArticleCategory).map((category: ArticleCategoryKeywords) => ({ path: `/posts/${category}`, title: ArticleCategory[category] })),
    { path: "/projects", title: "프로젝트" }
];