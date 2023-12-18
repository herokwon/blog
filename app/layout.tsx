import "./globals.css";
import { Noto_Sans_KR } from "next/font/google";
import { getTheme, updateTheme } from "./lib/functions/theme";
import { baseUrl } from "./lib/data/api";
import Nav from "./components/Nav";
import Sidebar from "./components/Sidebar";
import { ArticleResponse } from "./types/notion";

const noto_sans_kr = Noto_Sans_KR({
    weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
    subsets: ['latin'],
    variable: '--font-noto-sans-kr'
});

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const savedTheme = await getTheme();
    if (!savedTheme) updateTheme("light");

    const response = await fetch(`${baseUrl}/api/database/article?page_size=3`);

    const articleResponse: ArticleResponse = await response.json();

    // const articleData = new ArticleResponse(articleResponse.items, null);

    return (
        <html lang="ko" className={savedTheme ?? "light"}>
            <head>
            </head>
            <body className={noto_sans_kr.variable}>
                <Nav initTheme={savedTheme ?? "light"} />
                <Sidebar latestArticles={articleResponse.items} />
                {children}
            </body>
        </html>
    );
}