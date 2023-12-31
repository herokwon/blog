'use client'

import { MouseEvent, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Moon, Search, Sun } from "lucide-react";
import Link from "next/link";

import { ArticleCategoryKeywords, PreviewArticles } from "../types/notion";
import { BlogTheme, updateTheme } from "../lib/functions/theme";
import { navItem } from "../lib/data/navItem";
import useSidebar from "../store/sidebarStore";
import Button from "./Button";
import SidebarBtn from "./SidebarBtn";
import ArticlePreview from "./articles/ArticlePreview";

export default function Nav({ initTheme, previewArticles }: { initTheme: BlogTheme | undefined; previewArticles: PreviewArticles }) {
    const pathname = usePathname();
    const [theme, setTheme] = useState<BlogTheme>(initTheme ?? "light");
    const [categoryCursor, setCategoryCursor] = useState<ArticleCategoryKeywords | null>(null);
    const [isScrolled, setIsScrolled] = useState<boolean>(false);
    const { sidebarActive, setSidebarActive } = useSidebar();

    const handleNavItemMouseEnter = (e: MouseEvent) => {
        const target = e.currentTarget as HTMLAnchorElement;
        const targetCategory = target.getAttribute("data-category");

        if (!targetCategory || targetCategory === "projects") return;

        setCategoryCursor(targetCategory as ArticleCategoryKeywords);
    };

    useEffect(() => { }, [pathname]);

    useEffect(() => {
        document.documentElement.className = theme;
        updateTheme(theme);
    }, [theme]);

    useEffect(() => {
        initTheme ? null : updateTheme("light");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 0);
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <header
            data-path={navItem.find((item) => item.path === pathname) || pathname.includes("/posts") || pathname.includes("/projects") ?
                pathname : "not-found"}
            id="main-header"
            className={`${isScrolled ? "scrolled" : ""}`}>
            <div className="h-full flex justify-start items-center flex-1">
                <Link href={navItem[0].path} className="mx-2">
                    <h1 className="text-blue-500">All of IT</h1>
                </Link>
            </div>
            <nav className="nav-container flex-[2]">
                {navItem.slice(1).map((item, index) =>
                    <Link
                        key={index}
                        href={item.path}
                        scroll={false}
                        data-category={item.path.slice(item.path.lastIndexOf("/") + 1)}
                        className={`nav-item ${pathname === item.path ? "selected" : ""}`}
                        onMouseEnter={handleNavItemMouseEnter}>
                        {item.title}
                    </Link>)}
            </nav>
            <div className="button-container flex-1">
                <Button innerType="icon" className={`${isScrolled ? "" : "hover:bg-neutral-500"}`}>
                    <Search />
                </Button>
                <Button innerType="icon" className={`mx-2 ${isScrolled ? "" : "hover:bg-neutral-500"} relative`} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                    <Sun className="scale-100 dark:scale-0 transition-transform duration-200 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1] dark:-z-[1]" />
                    <Moon className="scale-0 dark:scale-100 transition-transform duration-200 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-[1] dark:z-[1]" />
                </Button>
                <SidebarBtn
                    className={sidebarActive ? "active" : ""}
                    onClick={() => setSidebarActive(true)} />
            </div>
            <ArticlePreview
                previewArticles={previewArticles}
                categoryCursor={categoryCursor} />
        </header>
    );
}