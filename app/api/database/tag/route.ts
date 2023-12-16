import { NextResponse } from "next/server";
import { getHeaders, notionDatabaseUrl } from "@/app/lib/data/notion";
import { DatabaseObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { CategoryTagResponse } from "@/app/types/notion";

export const GET = async () => {
    try {
        const response = await fetch(notionDatabaseUrl, {
            method: "GET",
            headers: getHeaders,
            next: { revalidate: 0 }
        });

        if (!response.ok) throw new Error(response.statusText);

        const responseData: DatabaseObjectResponse = await response.json();
        const tagProperty = responseData.properties.Tag;

        if (tagProperty.type !== "multi_select") throw new Error("Wrong Access");

        const tags: CategoryTagResponse = tagProperty.multi_select.options.map(({ name }) => ({ name }));
        return NextResponse.json({ tags: tags });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ status: 500, statusText: message });
    }
};