'use client'

import { usePathname } from "next/navigation";
import { navItem } from "../data/navItem";
import { Search } from "lucide-react";
import Link from "next/link";

export default function Nav() {
    const pathname = usePathname();

    return (
        <header id="main-header" className="w-full h-48 px-4 backdrop-blur-lg sticky top-0 left-0 z-[99]">
            <div className="w-full max-w-screen-lg h-full mx-auto flex justify-between items-center">
                <div className="h-full flex justify-start items-center flex-1">
                    <Link href={navItem[0].path}>
                        <h1 className="text-blue-500">All of IT</h1>
                    </Link>
                </div>
                <nav className="h-full flex justify-center items-center">
                    {navItem.slice(1).map((item, index) =>
                        <Link
                            key={index}
                            href={item.path}
                            className={`nav-item ${pathname === item.path ? "selected" : ""}`}>
                            {item.title}
                        </Link>
                    )}
                </nav>
                <div className="flex justify-end items-center flex-1">
                    <button type="button" className="w-36 h-36 flex justify-center items-center rounded-full hover:bg-light-tertiary">
                        <Search />
                    </button>
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