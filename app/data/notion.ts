export const notionDatabaseId = process.env.NEXT_PUBLIC_NOTION_DATABASE_ID!;
export const notionDatabaseUrl = `https://api.notion.com/v1/databases/${notionDatabaseId}`;
export const notionBlockUrl = "https://api.notion.com/v1/blocks";

export const getHeaders = {
    "Authorization": `Bearer ${process.env.NEXT_PUBLIC_NOTION_TOKEN}`,
    "Notion-Version": "2022-06-28",
};

export const postHeaders = {
    ...getHeaders,
    "Content-Type": "application/json",
};