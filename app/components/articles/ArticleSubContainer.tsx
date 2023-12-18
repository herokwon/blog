import { ArticleProperty } from "@/app/types/notion";
import { ArticleCategory } from "@/app/lib/data/notion";
import { getDate } from "@/app/lib/utils/getDate";
import Link from "next/link";
import Button from "../Button";
import Image from "next/image";

type ArticleSubContainer = Pick<ArticleProperty, "Category" | "Title" | "Date" | "Thumbnail">;

export default function ArticleSubContainer({ Category, Title, Date, Thumbnail }: ArticleSubContainer) {
    return (
        <Link href={`/posts/${Category}/${encodeURIComponent(Title)}`} className="article-sub-container">
            <div className="h-full aspect-square rounded-lg opacity-bold shadow-2xl overflow-hidden transition-all duration-200 relative">
                <Image src={Thumbnail.url} fill sizes="1x" className="object-cover object-center" alt="article-thumbnail" />
            </div>
            <div className="h-full flex flex-col justify-between items-start">
                <h3 className="article-info">{Title}</h3>
                <div className="article-info w-full flex justify-between items-center text-[0.72rem]">
                    <Button innerType="text" >
                        {ArticleCategory[Category]}
                    </Button>
                    <span>{getDate(Date)}</span>
                </div>
            </div>
        </Link>
    );
}