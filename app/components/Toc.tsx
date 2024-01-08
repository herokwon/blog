'use client'

import { useState } from "react";
import Link from "next/link";

import { Headings } from "../types/notion";
import { useToc } from "../hooks/useToc";

export default function Toc({ headings }: { headings: Headings[] }) {
    const [activeId, setActiveId] = useState<string>("");

    useToc(headings, setActiveId);

    return (
        <div className="article-toc">
            {headings.map((heading, index) =>
                <Link
                    key={index}
                    href={`#${heading.content}`}
                    className={`toc-item ${heading.content === activeId}`}
                    style={{ marginLeft: (heading.count - 1) * 20 + 'px' }}>
                    {heading.content}
                </Link>)}
        </div>
    );
}