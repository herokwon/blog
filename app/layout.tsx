import { Noto_Sans_KR, Nunito } from "next/font/google";
import { config } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';
import Script from "next/script";
config.autoAddCss = false;

import { ArticleResponse } from "./types/notion";
import { fetchArticle } from "./lib/databases";
import { GA_ID } from "./lib/data/constants";
import { getTheme } from "./lib/functions/theme";
import { fetchPreviewArticles } from "./lib/functions/article";
import "./globals.css";
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
                <meta name="naver-site-verification" content="966343a9c23577938f4f0061e13ab3654c42c025" />
                <Script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
                <Script id="gtag-init" dangerouslySetInnerHTML={{
                    __html: `
                        window.dataLayer = window.dataLayer || [];
                        function gtag() {dataLayer.push(arguments);}
                        gtag('js', new Date());
                        gtag('config', '${GA_ID}', {
                            page_path: window.location.pathname,
                        });
                    `,
                }} />
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