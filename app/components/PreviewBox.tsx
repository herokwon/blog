'use client'

import Link from "next/link";
import Image from "next/image";

import { ArticleProperty } from "../types/notion";
import { getDate } from "../lib/utils/getDate";
import useThumbnail from "../hooks/useThumbnail";
import Spinner from "./Spinner";

type PreviewBox = Pick<ArticleProperty, "Category" | "Title" | "Date" | "Thumbnail">;

export default function PreviewBox({ Category, Title, Date, Thumbnail }: PreviewBox) {
    const { imgUrl, imgLoading, handleImgLoad, handleImgError } = useThumbnail(Thumbnail.url, Title);

    return (
        <Link
            href={Title ? `/posts/${Category}/${Title}` : ""}
            className="preview-box">
            <div className="w-full aspect-[4/3] relative">
                {imgLoading ?
                    <Spinner className="absolute top-0 left-0 z-10" /> :
                    null}
                <Image
                    src={imgUrl ?? Thumbnail.url ?? ""}
                    className="object-cover object-center"
                    fill
                    sizes="200px"
                    onLoad={handleImgLoad}
                    onError={handleImgError}
                    alt="preview-thumbnail" />
            </div>
            <div className="w-full aspect-[4/1] flex flex-col items-center text-center">
                <h2 className=" py-0.5 text-[0.96rem] line-clamp-1">{Title}</h2>
                {Date ?
                    <p className="py-0.5 text-[0.72rem]">{getDate(Date)}</p> :
                    null}
            </div>
        </Link>
    );
}