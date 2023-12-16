import { NextRequest, NextResponse } from "next/server";
import { getHeaders, notionBlockUrl } from "@/app/lib/data/notion";
import { BlockResponse } from "@/app/types/notion";
import { BlockObjectResponse, ListBlockChildrenResponse } from "@notionhq/client/build/src/api-endpoints";

export const POST = async (request: NextRequest) => {
    const { pageId }: { pageId?: string } = await request.json();

    try {
        if (!pageId) throw new Error("No parameters");

        const blocksResponse = new BlockResponse([], null);

        do {
            const response = await fetch(`${notionBlockUrl}/${pageId}/children${blocksResponse.nextCursor ? `?start_cursor=${blocksResponse.nextCursor}` : ""}`, {
                method: "GET",
                headers: getHeaders,
                next: { revalidate: 0 }
            });

            if (!response.ok) throw new Error(response.statusText);

            const responseData: ListBlockChildrenResponse = await response.json();

            blocksResponse.items.push(...responseData.results as BlockObjectResponse[]);
            blocksResponse.nextCursor = responseData.has_more ? responseData.next_cursor : null;
        } while (blocksResponse.nextCursor);

        return NextResponse.json({
            items: blocksResponse.items,
            nextCursor: blocksResponse.nextCursor
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ status: 500, statusText: message });
    }
};