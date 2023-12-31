import { Noto_Sans_KR, Nunito } from "next/font/google";
import { config } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';
config.autoAddCss = false;

import "./globals.css";
import { ArticleResponse } from "./types/notion";
import { fetchArticle } from "./lib/databases";
import { getTheme, updateTheme } from "./lib/functions/theme";
import { fetchPreviewArticles } from "./lib/functions/article";
import Nav from "./components/Nav";
import Sidebar from "./components/Sidebar";
import Footer from "./components/Footer";

const noto_sans_kr = Noto_Sans_KR({
    weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
    subsets: ['latin'],
    variable: '--font-noto-sans-kr',
    adjustFontFallback: false,
});

const nunito = Nunito({
    weight: ['200', '300', '400', '500', '600', '700', '800', '900', '1000'],
    subsets: ['latin'],
    variable: '--font-nunito',
    adjustFontFallback: false,
});

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const savedTheme = await getTheme();

    const response = await fetchArticle({ pageSize: 3 });
    const articleData = new ArticleResponse(response.items, response.nextCursor);

    const previewArticles = await fetchPreviewArticles();

    return (
        <html lang="ko" className={savedTheme ?? "light"}>
            <head>
            </head>
            <body className={`${noto_sans_kr.variable} ${nunito.variable}`}>
                <Nav initTheme={savedTheme ?? "light"} previewArticles={previewArticles} />
                <Sidebar latestArticles={articleData.items} />
                {children}
                <Footer />
            </body>
        </html>
    );
}