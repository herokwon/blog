'use client'

import ErrorContainer, { ErrorProps } from "@/app/components/ErrorContainer";

export default function Error({ error, reset }: ErrorProps) {
    return <ErrorContainer title="Article Page" error={error} reset={reset} />
}