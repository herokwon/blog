import { NextRequest, NextResponse } from "next/server";
import { getHeaders, notionBlockUrl } from "@/app/data/notion";
import { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export const POST = async (request: NextRequest) => {
    const { blockId }: { blockId?: string } = await request.json();

    try {
        if (!blockId) throw new Error("No parameters");

        const response = await fetch(`${notionBlockUrl}/${blockId}`, {
            method: "GET",
            headers: getHeaders,
            next: { revalidate: 0 }
        });

        if (!response.ok) throw new Error(response.statusText);

        const responseData: BlockObjectResponse = await response.json();
        return NextResponse.json({ block: responseData });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ status: 500, statusText: message });
    }
};