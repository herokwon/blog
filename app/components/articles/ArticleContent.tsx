'use client'

import { useState } from "react";

import { Headings } from "@/app/types/notion";
import { useToc } from "@/app/hooks/useToc";
import Toc from "../Toc";

export default function ArticleContent({ headings, children }: { headings: Headings[]; children: React.ReactNode; }) {
    const [activeId, setActiveId] = useState<string>("");

    useToc(children, setActiveId);

    return (
        <article className="article-content">
            {children}
            <Toc activeId={activeId} headings={headings} />
        </article>
    );
}