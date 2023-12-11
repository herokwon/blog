'use client'

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BlogTheme, updateTheme } from "../lib/theme";
import { navItem } from "../data/navItem";
import { Moon, Search, Sun } from "lucide-react";
import Link from "next/link";
import Button from "./Button";

export default function Nav({ initTheme }:{initTheme: BlogTheme }) {
    const pathname = usePathname();
    const [theme, setTheme] = useState<BlogTheme>(initTheme);

    useEffect(() => {
        document.documentElement.className = theme;
        updateTheme(theme);
    }, [theme]);

    return (
        <header id="main-header" className="w-full h-48 px-4 backdrop-blur-lg sticky top-0 left-0 z-[99]">
            <div className="w-full max-w-screen-lg h-full mx-auto flex justify-between items-center">
                <div className="h-full flex justify-start items-center flex-1">
                    <Link href={navItem[0].path} className="max-md:absolute max-md:top-1/2 max-md:left-1/2 max-md:-translate-x-1/2 max-md:-translate-y-1/2 max-md:z-[1]">
                        <h1 className="text-blue-500">All of IT</h1>
                    </Link>
                </div>
                <nav className="h-full hidden md:flex justify-center items-center">
                    {navItem.slice(1).map((item, index) =>
                        <Link
                            key={index}
                            href={item.path}
                            className={`nav-item ${pathname === item.path ? "selected" : ""}`}>
                            {item.title}
                        </Link>
                    )}
                </nav>
                <div className="h-full flex justify-end items-center flex-1">
                    <Button innerType="icon" className="relative" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                        <Sun className="scale-100 dark:scale-0 transition-transform duration-200 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1] dark:-z-[1]" />
                        <Moon className="scale-0 dark:scale-100 transition-transform duration-200 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-[1] dark:z-[1]" />
                    </Button>
                    <Button innerType="icon">
                        <Search />
                    </Button>
                </div>
            </div>
            <section className="article-preview absolute top-full left-1/2 -translate-x-1/2 z-[99]">
                {Array.from(Array(3)).map((_, i) =>
                    <div key={i} className="preview-box"></div>
                )}
            </section>
        </header>
    );
}