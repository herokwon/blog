'use server'

import { BlockObjectResponse, ListBlockChildrenResponse, RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints";

import { SummaryResponse } from "@/app/types/notion";
import { getHeaders, notionBlockUrl } from "../data/notion";
import { convertRichToPlain } from "../functions/notion";

const minLength = 200;

export const fetchSummary = async (pageId: string): Promise<{ summary: string }> => {
    const summaryResponse = new SummaryResponse([], null);

    try {
        do {
            const requestUrl =
                `${notionBlockUrl}/${pageId}/children?page_size=9` +
                (summaryResponse.nextCursor ? `&start_cursor=${summaryResponse.nextCursor}` : "");

            const response = await fetch(requestUrl, {
                method: "GET",
                headers: getHeaders,
                next: { revalidate: 0 },
            });

            if (!response.ok) throw new Error(response.statusText);

            const responseData: ListBlockChildrenResponse = await response.json();
            const blocks = responseData.results as BlockObjectResponse[];

            summaryResponse.nextCursor = responseData.has_more ? responseData.next_cursor : null;
            summaryResponse.items.push(...extractSummary(blocks));

            if (summaryResponse.length() >= 200) return { summary: summaryResponse.getSummary() };
        } while (summaryResponse.length() < minLength || summaryResponse.nextCursor !== null);

        return { summary: summaryResponse.getSummary() };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(message);
    }
};

const extractSummary = (blocks: BlockObjectResponse[]): string[] => {
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