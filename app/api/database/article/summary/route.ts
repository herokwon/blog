import { NextRequest, NextResponse } from "next/server";
import { SummaryResponse } from "@/app/types/notion";
import { getHeaders, notionBlockUrl } from "@/app/lib/data/notion";
import { BlockObjectResponse, ListBlockChildrenResponse, RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints";
import { convertRichToPlain } from "@/app/lib/functions/notion";

const minLength = 200;

export const POST = async (req: NextRequest) => {
    try {
        const { pageId }: { pageId: string } = await req.json();

        const summaryResponse = new SummaryResponse([], null);

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

            summaryResponse.items.push(...updatelist(blocks));

            if (summaryResponse.length() > minLength) {
                return NextResponse.json({ summary: summaryResponse.getSummary() });
            }
        } while (summaryResponse.length() <= minLength || summaryResponse.nextCursor !== null);

        return NextResponse.json({ summary: summaryResponse.getSummary() });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ status: 500, statusText: message });
    }
};

const updatelist = (blocks: BlockObjectResponse[]) => {
    const textItems: string[] = [];
    let textLength = 0;

    for (const block of blocks) {
        if (block.type === "heading_1" ||
            block.type === "heading_2" ||
            block.type === "heading_3" ||
            block.type === "paragraph" ||
            block.type === "code" ||
            block.type === "callout" ||
            block.type === "quote") {
            const richText: RichTextItemResponse[] = block[block.type].rich_text
            const plainText = convertRichToPlain(richText);

            textItems.push(plainText);
            textLength += plainText.length;
        }

        if (textLength > minLength) return textItems;
    }

    return textItems;
};