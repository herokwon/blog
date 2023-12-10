import "./globals.css";
import { Noto_Sans_KR } from "next/font/google";
import Nav from "./components/Nav";

const noto_sans_kr = Noto_Sans_KR({
    weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
    subsets: ['latin'],
    variable: '--font-noto-sans-kr'
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ko" className={`${noto_sans_kr.variable}`}>
            <head>
            </head>
            <body>
                <Nav />
                {children}
            </body>
        </html>
    );
}