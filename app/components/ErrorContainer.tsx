'use client'

import { RotateCcw } from "lucide-react";

import Button from "./Button";

export interface ErrorProps {
    title?: string;
    error: Error & {
        digest?: string
    };
    reset: () => void;
};

export default function ErrorContainer({ title, error, reset }: ErrorProps) {
    return (
        <section className="w-full min-h-screen flex flex-col justify-center items-center">
            <h1>Error</h1>
            {title ?
                <h2>{title}</h2> : null}
            <div className="my-block">
                <h3>오류 내용</h3>
                <p className="px-4 py-2 my-2 rounded-lg text-center bg-light-secondary dark:bg-dark-secondary">{error.message}</p>
            </div>
            <div className="my-block">
                <Button
                    innerType="text"
                    className="bg-light-tertiary dark:bg-dark-tertiary"
                    onClick={reset}>
                    <span className="mx-2">다시 시도하기</span>
                    <RotateCcw size={16} />
                </Button>
            </div>
        </section>
    );
}