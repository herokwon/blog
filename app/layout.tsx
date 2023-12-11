import "./globals.css";
import { Noto_Sans_KR } from "next/font/google";
import { getTheme, updateTheme } from "./lib/theme";
import Nav from "./components/Nav";

const noto_sans_kr = Noto_Sans_KR({
    weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
    subsets: ['latin'],
    variable: '--font-noto-sans-kr'
});

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const savedTheme = await getTheme();
    if (!savedTheme) updateTheme("light");

    return (
        <html lang="ko" className={savedTheme ?? "light"}>
            <head>
            </head>
            <body className={noto_sans_kr.variable}>
                <Nav initTheme={savedTheme ?? "light"} />
                {children}
            </body>
        </html>
    );
}