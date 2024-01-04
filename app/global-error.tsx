'use client'

import ErrorContainer, { ErrorProps } from "./components/ErrorContainer";

export default function GlobalError({ error, reset }: ErrorProps) {
    console.log(error);

    return (
        <html lang="ko">
            <body>
                <ErrorContainer title="Main Page" error={error} reset={reset} />
            </body>
        </html>
    );
}