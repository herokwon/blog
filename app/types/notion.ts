import {
    BlockObjectResponse,
    BulletedListItemBlockObjectResponse,
    DatePropertyItemObjectResponse,
    FilesPropertyItemObjectResponse,
    MultiSelectPropertyItemObjectResponse,
    NumberedListItemBlockObjectResponse,
    PageObjectResponse,
    QueryDatabaseParameters,
    RichTextItemResponse,
    RichTextPropertyItemObjectResponse,
    SelectPropertyItemObjectResponse,
    StatusPropertyItemObjectResponse,
    TitlePropertyItemObjectResponse
} from "@notionhq/client/build/src/api-endpoints";

export type DatabaseQueryParameters = Omit<QueryDatabaseParameters, "database_id">;

export type SelectPropertyItem = Omit<SelectPropertyItemObjectResponse, "object">;
export type MultiSelectPropertyItem = Omit<MultiSelectPropertyItemObjectResponse, "object">;
export type StatusPropertyItem = Omit<StatusPropertyItemObjectResponse, "object">;
export type TitlePropertyItem = Omit<TitlePropertyItemObjectResponse, "object">;
export type DatePropertyItem = Omit<DatePropertyItemObjectResponse, "object">;
export type RichTextPropertyItem = Omit<RichTextPropertyItemObjectResponse, "object">;
export type FilesPropertyItem = Omit<FilesPropertyItemObjectResponse, "object">;

export const ArticleCategory = {
    dev: "개발",
    retrospect: "회고",
    study: "공부",
    column: "칼럼",
    life: "일상",
} as const;
type ArticleCategory = typeof ArticleCategory[keyof typeof ArticleCategory];

export type ArticleCategoryKeywords = keyof typeof ArticleCategory;

export type PreviewArticles = {
    [key in ArticleCategoryKeywords]: ArticleProperty[];
};
export interface ArticleProperty {
    Category: ArticleCategoryKeywords;
    Title: string | null;
    Date: string | null;
    Description: string | null;
    Tag: { name: string }[];
    Thumbnail: {
        url: string | null;
        expiry_time?: string;
    };
    Status: string;
};

export type ArticleSubProperty = Pick<ArticleProperty, "Category" | "Title" | "Date" | "Thumbnail">;

class NotionApiResponse {
    constructor(
        public nextCursor: string | null) { };
}

interface ItemsLength {
    length: () => number;
};

export class ArticleResponse extends NotionApiResponse implements ItemsLength {
    constructor(
        private _items: PageObjectResponse[],
        nextCursor: string | null) {
        super(nextCursor);
    };

    get items(): PageObjectResponse[] {
        return this._items;
    };

    length() {
        return this.items.length;
    }
};

export class SummaryResponse extends NotionApiResponse implements ItemsLength {
    constructor(
        private _items: string[],
        nextCursor: string | null) {
        super(nextCursor);
    };

    get items(): string[] {
        return this._items;
    };

    getSummary() {
        return this.items.map((item) => item).join(" ");
    };

    length() {
        return this.getSummary().length;
    };
};

export class BlockResponse extends NotionApiResponse {
    constructor(
        private _items: BlockObjectResponse[],
        nextCursor: string | null
    ) {
        super(nextCursor);
    };

    get items(): BlockObjectResponse[] {
        return this._items;
    }
};

export type CategoryResponse = { category: ArticleCategoryKeywords }[];
export type TagResponse = { tag: string }[];

export type RichTextColors = RichTextItemResponse["annotations"]["color"];
export type ListItemBlockObjectResponse = NumberedListItemBlockObjectResponse | BulletedListItemBlockObjectResponse;
export type ListItemBlock<T> = T extends number ? NumberedListItemBlockObjectResponse : BulletedListItemBlockObjectResponse;

export interface ImageBlockData {
    url: string;
    expiring: boolean;
};

export interface BookmarkMetadata {
    title: string | null;
    description: string | null;
    faviconUrl: string | null;
    imgData: {
        url: string;
        base64: string;
    } | null;
};