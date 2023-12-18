'use client'

import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { extractArticleProperties } from "../lib/functions/notion";
import { ArticleCategory } from "../lib/data/notion";
import { getDate } from "../lib/utils/getDate";
import useSidebar from "../store/sidebarStore";
import Button from "./Button";
import Link from "next/link";
import Image from "next/image";

export default function Sidebar({ latestArticles }: { latestArticles: PageObjectResponse[] }) {
    const { sidebarActive, setSidebarActive } = useSidebar();

    return (
        <section id="sidebar" className={`w-full min-w-screen h-full min-h-screen ${sidebarActive ? "" : "opacity-0 pointer-events-none"} overflow-y-scroll overscroll-none transition-opacity duration-200 fixed top-0 left-0 z-[100]`}>
            <aside className="w-300 h-full pl-4">
                <div className="w-full h-48 flex items-center">
                    <Button innerType="text" className={`sidebar-btn ${sidebarActive ? "active" : ""}`}
                        onClick={() => setSidebarActive(false)}>
                        <div>
                            <span />
                            <span />
                            <span />
                        </div>
                    </Button>
                </div>
                <div className="sidebar-container">
                    <h2 className="mt-2 mb-4 text-[1.2rem]">최근 업데이트</h2>
                    <article className="my-4 grid auto-rows-auto gap-y-4">
                        {latestArticles.map((article) => {
                            const properties = extractArticleProperties(article.properties);

                            return (
                                <Link key={article.id}
                                    href={`/posts/${properties.Category}/${encodeURIComponent(properties.Title)}`}
                                    className="article-sub-container">
                                    <div className="h-full aspect-square rounded-lg overflow-hidden relative">
                                        <Image src={properties.Thumbnail.url} fill sizes="1x" className="object-cover object-center" alt="article-thumbnail" />
                                    </div>
                                    <div className="h-full flex flex-col justify-between items-start">
                                        <h3 className="article-info">{properties.Title}</h3>
                                        <div className="article-info w-full flex justify-between items-center text-[0.72rem]">
                                            <Button innerType="text" style={{ padding: "0.1875rem 0.375rem" }}>
                                                {ArticleCategory[properties.Category]}
                                            </Button>
                                            <span>{getDate(properties.Date)}</span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </article>
                </div>
            </aside>
        </section>
    );
}