import { TableBlockObjectResponse, TableRowBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import { fetchBlocks } from "@/app/lib/databases";
import TableRow from "./TableRow";

export default async function Table({ block }: { block: TableBlockObjectResponse }) {
    const children = block.has_children ? await fetchBlocks(block.id) : null;

    return (
        <div className="article-content--table-container">
            <table className="article-content--table">
                <>
                    {!block.table.has_column_header ?
                        null :
                        <thead>
                            <TableRow
                                block={children?.items[0] as TableRowBlockObjectResponse}
                                rowIndex={0}
                                rowHeader={block.table.has_row_header}
                                columnHeader={block.table.has_column_header} />
                        </thead>
                    }
                    <tbody>
                        {children?.items.slice(block.table.has_column_header ? 1 : 0).map((tableRow, index) =>
                            <TableRow
                                key={tableRow.id}
                                block={tableRow as TableRowBlockObjectResponse}
                                rowIndex={block.table.has_column_header ? index + 1 : index}
                                rowHeader={block.table.has_row_header}
                                columnHeader={block.table.has_column_header} />)}
                    </tbody>
                </>
            </table>
        </div>
    );
}