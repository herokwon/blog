'use client'

import { useEffect, useState } from "react";
import { List, X } from "lucide-react";
import Link from "next/link";

import { Headings } from "../types/notion";
import { useToc } from "../hooks/useToc";
import Button from "./Button";

export default function Toc({ headings }: { headings: Headings[] }) {
    const [activeId, setActiveId] = useState<string>("");
    const [isTocActive, setIsTocActive] = useState<boolean>(false);

    useToc(headings, setActiveId);

    useEffect(() => {
        const rangeStart = window.innerHeight * 0.5;
        const rangeEnd = window.innerHeight * 0.75;

        let lastScrollY = window.scrollY;

        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            if ((currentScrollY > lastScrollY) && (rangeStart < currentScrollY) && (currentScrollY < rangeEnd)) {
                setIsTocActive(true);
            }

            lastScrollY = currentScrollY;
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <>
            <div className={`article-toc--container ${isTocActive ? "active" : ""}`}>
                <div className="w-full mb-content flex justify-start items-center">
                    <Button innerType="icon" onClick={() => setIsTocActive(false)}>
                        <X />
                    </Button>
                </div>
                {headings.map((heading, index) =>
                    <div
                        key={index}
                        className="w-full block my-content"
                        style={{ paddingLeft: `${(heading.count - 1) * 20}px` }}>
                        <Link href={`#${heading.content}`} className={`toc-item ${heading.content === activeId ? "selected" : ""}`}>
                            {heading.content}
                        </Link>
                    </div>
                )}
            </div>
            <Button
                innerType="icon"
                className="article-toc--btn relative"
                onClick={() => setIsTocActive(true)}>
                <List size={20} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </Button>
        </>
    );
}