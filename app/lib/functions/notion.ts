import { RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints";
import { ArticleProperty, DatePropertyItem, FilesPropertyItem, MultiSelectPropertyItem, RichTextPropertyItem, SelectPropertyItem, StatusPropertyItem, TitlePropertyItem } from "../../types/notion";
import { fetchSummary } from "../databases";

export const extractArticleProperties = (properties: object): ArticleProperty => {
    const propertyEntries = Object.keys(properties).map((property: keyof ArticleProperty) => {
        switch (property) {
            case "Category":
                const categoryItem: SelectPropertyItem = properties["Category"];
                return [property, categoryItem.select?.name ?? null];
            case "Title":
                const titleItem: TitlePropertyItem = properties["Title"];
                return [property, titleItem.title[0].text.content as string];
            case "Date":
                const dateItem: DatePropertyItem = properties["Date"];
                return [property, dateItem.date?.start ?? null];
            case "Description":
                const descriptionItem: RichTextPropertyItem = properties["Description"];
                return [property, descriptionItem.rich_text[0].text.content as string];
            case "Tag":
                const tagItem: MultiSelectPropertyItem = properties["Tag"];
                return [property, tagItem.multi_select.map((tag) => ({ name: tag.name }))];
            case "Thumbnail":
                const thumbnailItem: FilesPropertyItem = properties["Thumbnail"];
                const thumbnailFileItem: {
                    url: string | null;
                    expiry_time?: string;
                } = thumbnailItem.files[0].type === "file" ? thumbnailItem.files[0].file : thumbnailItem.files[0].type === "external" ? thumbnailItem.files[0].external : { url: null };
                return [property, thumbnailFileItem];
            case "Status":
                const statusItem: StatusPropertyItem = properties["Status"];
                return [property, statusItem.status?.name ?? null];
        }
    });

    return Object.fromEntries(propertyEntries);
};

export const arrangeArticleSummary = async (id: string): Promise<string> => {
    const { summary } = await fetchSummary(id);
    return summary;
};

export const convertRichToPlain = (rich_text: RichTextItemResponse[]): string => {
    return rich_text.map((text) => text.plain_text).join("");
};