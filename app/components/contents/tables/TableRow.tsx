import { RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints";

import RichText from "../RichText";

export default function TableHeader({ cell }: { cell: RichTextItemResponse[] }) {
    return (
        <th>
            <RichText richTexts={cell} />
        </th>
    );
}