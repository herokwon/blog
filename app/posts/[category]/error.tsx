'use client'

import ErrorContainer, { ErrorProps } from "@/app/components/ErrorContainer";

export default function Error({ error, reset }: ErrorProps) {
    return <ErrorContainer title="Category Page" error={error} reset={reset} />
}