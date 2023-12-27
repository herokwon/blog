'use server'

import { PageObjectResponse, QueryDatabaseResponse } from "@notionhq/client/build/src/api-endpoints";

import { ArticleCategoryKeywords, DatabaseQueryParameters } from "@/app/types/notion";
import { notionDatabaseUrl, postHeaders } from "../data/notion";

interface FetchArticle {
    category?: ArticleCategoryKeywords;
    title?: string;
    tags?: { tag: string }[];
    pageSize?: number;
    startCursor?: string;
};

type FilterProperty = Pick<FetchArticle, "category" | "title" | "tags">;
type FilterObject = DatabaseQueryParameters["filter"];

export const fetchArticle = async ({ category, title, tags, pageSize, startCursor }: FetchArticle): Promise<{
    items: PageObjectResponse[];
    nextCursor: string | null;
}> => {
    const queryParams: DatabaseQueryParameters = {
        filter: convertQueryParams({ category, title, tags }),
        sorts: [{
            property: "Date",
            direction: "descending",
        }],
        page_size: pageSize ?? 9,
        start_cursor: startCursor,
    };

    try {
        const response = await fetch(`${notionDatabaseUrl}/query`, {
            method: "POST",
            headers: postHeaders,
            next: { revalidate: 0 },
            body: JSON.stringify(queryParams),
        });

        if (!response.ok) throw new Error(response.statusText);

        const responseData: QueryDatabaseResponse = await response.json();

        return {
            items: responseData.results as PageObjectResponse[],
            nextCursor:
                responseData.has_more ?
                    responseData.next_cursor :
                    null,
        };
    } catch (error) {
        const message =
            error instanceof Error ?
                error.message :
                String(error);

        throw new Error(message)
    }
};

const convertQueryParams = ({ category, title, tags }: FilterProperty): FilterObject => {
    const queryParams: FilterObject = {
        and: [
            {
                property: "Status",
                status: {
                    equals: "Published",
                },
            },
        ],
    };

    if (category) {
        queryParams.and.push({
            property: "Category",
            select: {
                equals: category,
            },
        });
    }

    if (title) {
        queryParams.and.push({
            property: "Title",
            title: {
                equals: title,
            },
        });
    }

    if (tags) {
        queryParams.and.push({
            or: [
                ...tags.map((data) => ({
                    property: "Tag",
                    multi_select: {
                        contains: data.tag,
                    },
                })),
            ],
        });
    }

    return queryParams;
};