import { RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints";
import { ImageBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import { ArticleProperty, DatePropertyItem, FilesPropertyItem, MultiSelectPropertyItem, RichTextColors, RichTextPropertyItem, SelectPropertyItem, StatusPropertyItem, TitlePropertyItem } from "@/app/types/notion";
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

export const convertRichToPlain = (richText: RichTextItemResponse[]) => {
    return richText.map((text) => text.plain_text).join("");
};

const extractRichTextColor = (color: RichTextColors) => {
    if (color.includes("background")) {
        return `bg-${color.replace("_background", "")}-500`;
    } else {
        return `text-${color}-500`;
    }
};

export const extractRichTextStyle = (richText: RichTextItemResponse): string => {
    const annotations = richText.annotations;
    const styles: string[] = [];

    if (annotations.bold) styles.push("font-semibold");
    if (annotations.italic) styles.push("italic");
    if (annotations.strikethrough) styles.push("line-through");
    if (annotations.underline) styles.push("underline");

    if (annotations.color !== "default") styles.push(extractRichTextColor(annotations.color));

    return styles.join(" ");
};

export const getImage = (block: ImageBlockObjectResponse): { url: string; expiring: boolean } => {
    switch (block.image.type) {
        case "external":
            return {
                url: block.image.external.url,
                expiring: false,
            };
        case "file":
            return {
                url: block.image.file.url,
                expiring: true,
            };
    }
};