import { BlockObjectResponse, DatePropertyItemObjectResponse, FilesPropertyItemObjectResponse, MultiSelectPropertyItemObjectResponse, PageObjectResponse, QueryDatabaseParameters, RichTextItemResponse, RichTextPropertyItemObjectResponse, SelectPropertyItemObjectResponse, StatusPropertyItemObjectResponse, TitlePropertyItemObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export type DatabaseQueryParameters = Omit<QueryDatabaseParameters, "database_id">;

export type SelectPropertyItem = Omit<SelectPropertyItemObjectResponse, "object">;
export type MultiSelectPropertyItem = Omit<MultiSelectPropertyItemObjectResponse, "object">;
export type StatusPropertyItem = Omit<StatusPropertyItemObjectResponse, "object">;
export type TitlePropertyItem = Omit<TitlePropertyItemObjectResponse, "object">;
export type DatePropertyItem = Omit<DatePropertyItemObjectResponse, "object">;
export type RichTextPropertyItem = Omit<RichTextPropertyItemObjectResponse, "object">;
export type FilesPropertyItem = Omit<FilesPropertyItemObjectResponse, "object">;

export interface ArticleProperty {
    Category: string;
    Title: string;
    Date: string;
    Description: string;
    Tag: { name: string }[];
    Thumbnail: {
        url: string;
        expiry_time?: string;
    };
    Status: string;
};

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

export class BlockResponse extends NotionApiResponse implements ItemsLength {
    constructor(
        private _items: BlockObjectResponse[],
        nextCursor: string | null
    ) {
        super(nextCursor);
    };

    get items(): BlockObjectResponse[] {
        return this._items;
    }

    length() {
        return this._items.length;
    }
};

export type CategoryResponse = { category: string }[];
export type TagResponse = { tag: string }[];