import { NextResponse } from "next/server";
import { getHeaders, notionDatabaseUrl } from "@/app/lib/data/notion";
import { DatabaseObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { ArticleCategory, CategoryResponse } from "@/app/types/notion";

export const GET = async () => {
    try {
        const response = await fetch(notionDatabaseUrl, {
            method: "GET",
            headers: getHeaders,
            next: { revalidate: 0 }
        });

        if (!response.ok) throw new Error(response.statusText);

        const responseData: DatabaseObjectResponse = await response.json();
        const categoryProperty = responseData.properties.Category;

        if (categoryProperty.type !== "select") throw new Error("Wrong Access");

        const categories: CategoryResponse = categoryProperty.select.options.map(({ name }) => ({ category: name as keyof typeof ArticleCategory }));
        return NextResponse.json({ categories: categories });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ status: 500, statusText: message });
    }
};