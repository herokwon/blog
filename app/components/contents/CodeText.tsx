export default function CodeText({ code, children }: { code: boolean; children: React.ReactNode }) {
    if (!code) return children;

    return (
        <code className="article-content--inline-code">
            {children}
        </code>
    );
}