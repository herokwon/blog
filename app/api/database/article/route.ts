import { NextRequest, NextResponse } from "next/server";
import { DatabaseQueryParameters } from "@/app/types/notion";
import { notionDatabaseUrl, postHeaders } from "@/app/data/notion";
import { PageObjectResponse, QueryDatabaseResponse } from "@notionhq/client/build/src/api-endpoints";

export const GET = async (req: NextRequest) => {
    const pageSize: string | null = req.nextUrl.searchParams.get("page_size");

    const paramsQuery: DatabaseQueryParameters = {
        filter: {
            property: "Status",
            status: {
                equals: "Published",
            },
        },
        sorts: [
            {
                property: "Date",
                direction: "descending",
            },
        ],
        page_size: pageSize ? parseInt(pageSize) : 9,
    };

    try {
        const response = await fetch(`${notionDatabaseUrl}/query`, {
            method: "POST",
            headers: postHeaders,
            next: { revalidate: 0 },
            body: JSON.stringify(paramsQuery),
        });

        if (!response.ok) throw new Error(response.statusText);

        const responseData: QueryDatabaseResponse = await response.json();

        return NextResponse.json({
            articles: responseData.results as PageObjectResponse[],
            nextCursor: responseData.has_more ? responseData.next_cursor : null,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ status: 500, statusText: message });
    }
};

export const POST = async (req: NextRequest) => {
    const { nextCursor }: { nextCursor: string | null } = await req.json();

    const paramsQuery: DatabaseQueryParameters = {
        filter: {
            and: [
                {
                    property: "Status",
                    status: {
                        equals: "Published",
                    },
                },
                updateParamsQuery(req.nextUrl.searchParams),
            ],
        },
        sorts: [
            {
                property: "Date",
                direction: "descending",
            },
        ],
        page_size: 9,
    }

    try {
        const response = await fetch(`${notionDatabaseUrl}/query`, {
            method: "POST",
            headers: postHeaders,
            next: { revalidate: 0 },
            body: JSON.stringify(nextCursor ? {
                ...paramsQuery,
                start_cursor: nextCursor,
            } : paramsQuery),
        });

        if (!response.ok) throw new Error(response.statusText);

        const responseData: QueryDatabaseResponse = await response.json();

        return NextResponse.json({
            articles: responseData.results as PageObjectResponse[],
            nextCursor: responseData.has_more ? responseData.next_cursor : null,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ status: 500, statusText: message });
    }
};

const updateParamsQuery = (params: URLSearchParams) => {
    const paramsObject = Object.fromEntries(params.entries());

    switch (true) {
        case "category" in paramsObject:
            return {
                property: "Category",
                select: {
                    equals: params.get("category")
                }
            };
        case "title" in paramsObject:
            return {
                property: "Title",
                title: {
                    equals: params.get("title")
                }
            };
        case "tag" in paramsObject:
            return {
                property: "Tag",
                multi_select: {
                    contains: params.get("tag")
                }
            };
    }
};