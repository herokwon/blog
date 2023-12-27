import { ArticleCategoryKeywords, PreviewArticles } from "@/app/types/notion";
import PreviewBox from "../PreviewBox";

export default function ArticlePreview({ previewArticles, categoryCursor }: { previewArticles: PreviewArticles; categoryCursor: ArticleCategoryKeywords | null }) {
    return (
        <section className="article-preview">
            {Object.keys(previewArticles).map((category: ArticleCategoryKeywords) =>
                <div
                    key={category}
                    className={`preview-container ${category === categoryCursor ? "active" : ""}`}>
                    {previewArticles[category].map((property, index) =>
                        <PreviewBox
                            key={index}
                            Category={property.Category}
                            Title={property.Title}
                            Date={property.Date}
                            Thumbnail={property.Thumbnail} />
                    )}
                </div>
            )}
        </section>
    );
}