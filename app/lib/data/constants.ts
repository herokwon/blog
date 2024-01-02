import { StaticImageData } from "next/dist/shared/lib/get-img-props";

import { ArticleCategoryKeywords } from "@/app/types/notion";
import DevImage from "@/public/images/dev.png";
import RetrospectImage from "@/public/images/retrospect.png";
import StudyImage from "@/public/images/study.png";
import ColumnImage from "@/public/images/column.png";
import LifeImage from "@/public/images/life.png";

export const isProd = process.env.NODE_ENV === "production";

export const AUTHOR = process.env.NEXT_PUBLIC_AUTHOR!;
export const CONTACT = process.env.NEXT_PUBLIC_CONTACT!;
export const BASE_URL =
    isProd ?
        process.env.NEXT_PUBLIC_SITE_URL! : 'http://localhost:3000';

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID!;

export const CategoryHeader: { [key in ArticleCategoryKeywords]: StaticImageData } = {
    dev: DevImage,
    retrospect: RetrospectImage,
    study: StudyImage,
    column: ColumnImage,
    life: LifeImage,
};