import "./globals.css";
import { Noto_Sans_KR } from "next/font/google";
import { ArticleResponse } from "./types/notion";
import { fetchArticle } from "./lib/databases";
import { getTheme, updateTheme } from "./lib/functions/theme";
import Nav from "./components/Nav";
import Sidebar from "./components/Sidebar";

const noto_sans_kr = Noto_Sans_KR({
    weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
    subsets: ['latin'],
    variable: '--font-noto-sans-kr'
});

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const savedTheme = await getTheme();

    if (!savedTheme) updateTheme("light");

    const response = await fetchArticle({ pageSize: 3 });
    const articleData = new ArticleResponse(response.items, response.nextCursor);

    return (
        <html lang="ko" className={savedTheme ?? "light"}>
            <head>
            </head>
            <body className={noto_sans_kr.variable}>
                <Nav initTheme={savedTheme ?? "light"} />
                <Sidebar latestArticles={articleData.items} />
                {children}
            </body>
        </html>
    );
}