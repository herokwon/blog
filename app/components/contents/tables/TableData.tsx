import { RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints";

import RichText from "../RichText";

export default function TableData({ cell }: { cell: RichTextItemResponse[] }) {
    return (
        <td>
            <RichText richTexts={cell} />
        </td>
    );
}