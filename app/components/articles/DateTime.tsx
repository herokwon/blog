'use client'

import { HTMLAttributes } from "react";
import { getDate } from "../../lib/utils/getDate";

export default function DateTime({ date, ...props }: { date: string } & HTMLAttributes<HTMLSpanElement>) {
    return (
        <span {...props} className={`article-info--date ${props.className ?? ""}`}>
            {getDate(date)}
        </span>
    );
}