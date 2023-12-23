'use server'

import { DatabaseObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import { getHeaders, notionDatabaseUrl } from "../data/notion";
import { ArticleCategory, CategoryResponse } from "@/app/types/notion";

export const fetchAllCategories = async (): Promise<{ categories: CategoryResponse }> => {
    try {
        const response = await fetch(notionDatabaseUrl, {
            method: "GET",
            headers: getHeaders,
            next: { revalidate: 0 },
        });

        if (!response.ok) throw new Error(response.statusText);

        const responseData: DatabaseObjectResponse = await response.json();
        const categoryProperty = responseData.properties.Category;

        if (categoryProperty.type !== "select") throw new Error("Wrong Access!");

        return { categories: categoryProperty.select.options.map(({ name }) => ({ category: name as keyof typeof ArticleCategory })) };
    } catch (error) {
        const message =
            error instanceof Error ?
                error.message :
                String(error);

        throw new Error(message);
    }
};