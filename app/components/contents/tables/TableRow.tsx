import { TableRowBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import TableHeader from "./TableHeader";
import TableData from "./TableData";

interface TableRow {
    block: TableRowBlockObjectResponse;
    rowIndex: number;
    rowHeader: boolean;
    columnHeader: boolean;
};

export default function TableRow({ block, rowIndex, rowHeader, columnHeader }: TableRow) {
    return (
        <tr>
            {block.table_row.cells.map((cell, columnIndex) => {
                const index = rowIndex + columnIndex;

                switch (true) {
                    case rowHeader && columnHeader:
                        return rowIndex * columnIndex === 0 ?
                            <TableHeader key={index} cell={cell} /> :
                            <TableData key={index} cell={cell} />
                    case rowHeader && !columnHeader:
                        return columnIndex === 0 ?
                            <TableHeader key={index} cell={cell} /> :
                            <TableData key={index} cell={cell} />;
                    case !rowHeader && columnHeader:
                        return rowIndex === 0 ?
                            <TableHeader key={index} cell={cell} /> :
                            <TableData key={index} cell={cell} />;
                    default:
                        return <TableData key={index} cell={cell} />;
                }
            })}
        </tr>
    );
}