'use client'

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Moon, Search, Sun } from "lucide-react";
import Link from "next/link";

import { BlogTheme, updateTheme } from "../lib/functions/theme";
import { navItem } from "../lib/data/navItem";
import useSidebar from "../store/sidebarStore";
import Button from "./Button";

export default function Nav({ initTheme }: { initTheme: BlogTheme }) {
    const pathname = usePathname();
    const [theme, setTheme] = useState<BlogTheme>(initTheme);
    const [isScrolled, setIsScrolled] = useState<boolean>(false);
    const { sidebarActive, setSidebarActive } = useSidebar();

    useEffect(() => {
        document.documentElement.className = theme;
        updateTheme(theme);
    }, [theme]);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 0);
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <header id="main-header" className={`w-full h-48 px-4 flex items-center ${isScrolled ? "bg-light-primary dark:bg-dark-primary" : "text-dark"} transition-all duration-200 fixed top-0 left-0 z-[99]`}>
            <div className="h-full flex items-center flex-1">
                <Button innerType="text" className={`sidebar-btn ${isScrolled ? "scrolled" : ""} ${sidebarActive ? "active" : ""}`}
                    onClick={() => setSidebarActive(true)}>
                    <div>
                        <span />
                        <span />
                        <span />
                    </div>
                </Button>
            </div>
            <div className="w-full max-w-screen-lg h-full mx-auto flex justify-between items-center flex-[4] md:relative">
                <div className="h-full flex justify-start items-center flex-1">
                    <Link href={navItem[0].path} className="md:mx-2 max-md:absolute max-md:top-1/2 max-md:left-1/2 max-md:-translate-x-1/2 max-md:-translate-y-1/2 max-md:z-[1]">
                        <h1 className="text-blue-500">All of IT</h1>
                    </Link>
                </div>
                <nav className="h-full hidden md:flex justify-end items-center flex-[2]">
                    {navItem.slice(1).map((item, index) =>
                        <Link
                            key={index}
                            href={item.path}
                            className={`nav-item ${pathname === item.path ? "selected" : ""}`}>
                            {item.title}
                        </Link>
                    )}
                </nav>
                <section className="article-preview absolute top-full right-0 z-[99]">
                    {Array.from(Array(3)).map((_, i) =>
                        <div key={i} className="preview-box"></div>
                    )}
                </section>
            </div>
            <div className="h-full flex justify-end items-center flex-1">
                <Button innerType="icon" className={`${isScrolled ? "" : "hover:bg-neutral-500"}`}>
                    <Search />
                </Button>
                <Button innerType="icon" className={`mx-2 ${isScrolled ? "" : "hover:bg-neutral-500"} relative`} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                    <Sun className="scale-100 dark:scale-0 transition-transform duration-200 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1] dark:-z-[1]" />
                    <Moon className="scale-0 dark:scale-100 transition-transform duration-200 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-[1] dark:z-[1]" />
                </Button>
            </div>
        </header>
    );
}