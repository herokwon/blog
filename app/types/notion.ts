import { BlockObjectResponse, DatePropertyItemObjectResponse, FilesPropertyItemObjectResponse, MultiSelectPropertyItemObjectResponse, PageObjectResponse, QueryDatabaseParameters, RichTextItemResponse, RichTextPropertyItemObjectResponse, SelectPropertyItemObjectResponse, StatusPropertyItemObjectResponse, TitlePropertyItemObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export class ArticlesResponse {
    constructor(
        private _articles: PageObjectResponse[],
        private _nextCursor: string | null
    ) { };

    get articles(): PageObjectResponse[] {
        return this._articles;
    }
    get nextCursor(): string | null {
        return this._nextCursor;
    }
};

export class SummaryResponse {
    constructor(
        private _summaryPieces: string[],
        private _summaryLength: number,
        private _nextCursor: string | null,
    ) { };

    get summaryPieces(): string[] {
        return this._summaryPieces;
    }
    get summaryLength(): number {
        return this._summaryLength;
    }
    get nextCursor(): string | null {
        return this._nextCursor;
    }

    set summaryPieces(elem: string) {
        this._summaryPieces = [...this.summaryPieces, elem];
    }
    set summaryLength(length: number) {
        this._summaryLength = length;
    }
    set nextCursor(cursor: string | null) {
        this._nextCursor = cursor;
    }
};

export class BlocksResponse {
    constructor(
        private _blocks: BlockObjectResponse[],
        private _nextCursor: string | null,
    ) { };

    get blocks(): BlockObjectResponse[] {
        return this._blocks;
    }
    get nextCursor(): string | null {
        return this._nextCursor;
    }

    set nextCursor(cursor: string | null) {
        this._nextCursor = cursor;
    }
};

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