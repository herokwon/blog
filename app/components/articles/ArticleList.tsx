export default function ArticleList({ children }: { children: React.ReactNode }) {
    return (
        <article className="article-list">
            {children}
        </article>
    );
}