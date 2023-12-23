'use server'

import { BlockObjectResponse, ListBlockChildrenResponse } from "@notionhq/client/build/src/api-endpoints";

import { BlockResponse } from "@/app/types/notion";
import { getHeaders, notionBlockUrl } from "../data/notion";

export const fetchBlocks = async (pageId: string): Promise<{
    items: BlockObjectResponse[];
    nextCursor: null;
}> => {
    const blockResponse = new BlockResponse([], null);

    try {
        do {
            const requestUrl = `${notionBlockUrl}/${pageId}/children` + (blockResponse.nextCursor ? `?start_cursor=${blockResponse.nextCursor}` : "");

            const response = await fetch(requestUrl, {
                method: "GET",
                headers: getHeaders,
                next: { revalidate: 0 },
            });

            if (!response.ok) throw new Error(response.statusText);

            const responseData: ListBlockChildrenResponse = await response.json();

            blockResponse.items.push(...responseData.results as BlockObjectResponse[]);
            blockResponse.nextCursor =
                responseData.has_more ?
                    responseData.next_cursor :
                    null;
        } while (blockResponse.nextCursor);

        return {
            items: blockResponse.items,
            nextCursor: null,
        };
    } catch (error) {
        const message =
            error instanceof Error ?
                error.message :
                String(error);

        throw new Error(message);
    }
};

export const fetchBlock = async (blockId: string): Promise<{ block: BlockObjectResponse }> => {
    try {
        const response = await fetch(`${notionBlockUrl}/${blockId}`, {
            method: "GET",
            headers: getHeaders,
            next: { revalidate: 0 },
        });

        if (!response.ok) throw new Error(response.statusText);

        const responseData: BlockObjectResponse = await response.json();

        return { block: responseData };
    } catch (error) {
        const message =
            error instanceof Error ?
                error.message :
                String(error);

        throw new Error(message);
    }
};