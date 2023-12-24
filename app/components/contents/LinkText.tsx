import Link from "next/link";

export default function LinkText({ href, children }: { href: string | null; children: React.ReactNode }) {
    if (!href) return children;

    return (
        <Link target="_blank" href={href} className="article-content--link">
            {children}
        </Link>
    );
}