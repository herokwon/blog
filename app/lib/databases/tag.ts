'use server'

import { DatabaseObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { getHeaders, notionDatabaseUrl } from "../data/notion";
import { TagResponse } from "@/app/types/notion";

export const fetchAllTags = async (): Promise<{ tags: TagResponse }> => {
    try {
        const response = await fetch(notionDatabaseUrl, {
            method: "GET",
            headers: getHeaders,
            next: { revalidate: 0 },
        });

        if (!response.ok) throw new Error(response.statusText);

        const responseData: DatabaseObjectResponse = await response.json();
        const tagProperty = responseData.properties.Tag;

        if (tagProperty.type !== "multi_select") throw new Error("Wrong Access!");

        return { tags: tagProperty.multi_select.options.map(({ name }) => ({ tag: name })) };
    } catch (error) {
        const message =
            error instanceof Error ?
                error.message :
                String(error);

        throw new Error(message);
    }
};