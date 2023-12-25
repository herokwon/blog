import { RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints";

import RichText from "../texts/RichText";

export default function TableHeader({ cell }: { cell: RichTextItemResponse[] }) {
    return (
        <th>
            <RichText richTexts={cell} />
        </th>
    );
}