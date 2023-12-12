import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export class ArticlesResponse {
    constructor(
        private _articles: PageObjectResponse[], 
        private _nextCursor: string | null
    ) {};
    
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
        private _nextCursor: string | null
    ) {};
    
    get summaryPieces(): string[] { 
        return this._summaryPieces; 
    }
    get nextCursor(): string | null { 
        return this._nextCursor;
    }
};