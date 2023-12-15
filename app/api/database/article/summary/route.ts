import { NextRequest, NextResponse } from "next/server";
import { SummaryResponse } from "@/app/types/notion";
import { getHeaders, notionBlockUrl } from "@/app/lib/data/notion";
import { BlockObjectResponse, ListBlockChildrenResponse } from "@notionhq/client/build/src/api-endpoints";

const minLength = 200;

export const POST = async (req: NextRequest) => {
    try {
        const { pageId }: { pageId: string } = await req.json();

        const summaryResponse = new SummaryResponse([], 0, null);

        do {
            const response = await fetch(`${notionBlockUrl}/${pageId}/children?page_size=10${summaryResponse.nextCursor ? `&start_cursor=${summaryResponse.nextCursor}` : ""}`, {
                method: "GET",
                headers: getHeaders,
                next: { revalidate: 0 }
            });

            if (!response.ok) throw new Error(response.statusText);

            const responseData: ListBlockChildrenResponse = await response.json();

            const blocks = responseData.results as BlockObjectResponse[];
            summaryResponse.nextCursor = responseData.has_more ? responseData.next_cursor : null;

            summaryResponse.summaryPieces.push(...updateSummaryPieces(blocks, summaryResponse).summaryPieces);

            if (summaryResponse.summaryLength > minLength) {
                return NextResponse.json({ summary: summaryResponse.summaryPieces.join(" ") });
            }
        } while (summaryResponse.summaryLength <= minLength);

        return NextResponse.json({ summary: summaryResponse.summaryPieces.join(" ") });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ status: 500, statusText: message });
    }
};

const updateSummaryPieces = (blocks: BlockObjectResponse[], summaryResponse: SummaryResponse) => {
    for (const block of blocks) {
        switch (block.type) {
            case "heading_1":
                block.heading_1.rich_text.forEach((item) => {
                    summaryResponse.summaryPieces.push(item.plain_text);
                    summaryResponse.summaryLength += item.plain_text.length;
                });
                break;
            case "heading_2":
                block.heading_2.rich_text.forEach((item) => {
                    summaryResponse.summaryPieces.push(item.plain_text);
                    summaryResponse.summaryLength += item.plain_text.length;
                });
                break;
            case "heading_3":
                block.heading_3.rich_text.forEach((item) => {
                    summaryResponse.summaryPieces.push(item.plain_text);
                    summaryResponse.summaryLength += item.plain_text.length;
                });
                break;
            case "paragraph":
                block.paragraph.rich_text.forEach((item) => {
                    summaryResponse.summaryPieces.push(item.plain_text);
                    summaryResponse.summaryLength += item.plain_text.length;
                });
                break;
            case "callout":
                block.callout.rich_text.forEach((item) => {
                    summaryResponse.summaryPieces.push(item.plain_text);
                    summaryResponse.summaryLength += item.plain_text.length;
                });
                break;
            case "code":
                block.code.rich_text.forEach((item) => {
                    summaryResponse.summaryPieces.push(item.plain_text);
                    summaryResponse.summaryLength += item.plain_text.length;
                });
                break;
            case "quote":
                block.quote.rich_text.forEach((item) => {
                    summaryResponse.summaryPieces.push(item.plain_text);
                    summaryResponse.summaryLength += item.plain_text.length;
                });
                break;
            default:
                break;
        }

        if (summaryResponse.summaryLength > minLength) return summaryResponse;
    }

    return summaryResponse;
};