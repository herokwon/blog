'use client'

import { ArrowUpLeft, RotateCcw } from "lucide-react";

import Button from "./Button";
import { useRouter } from "next/navigation";

export interface ErrorProps {
    title?: string;
    error: Error & {
        digest?: string
    };
    reset: () => void;
};

export default function ErrorContainer({ title, error, reset }: ErrorProps) {
    const router = useRouter();

    return (
        <section className="w-full max-w-screen-lg min-h-screen mx-auto flex flex-col justify-center items-center">
            <h1 className="w-full text-center">{title ? `Error : ${title}` : "Error"}</h1>
            <p className="w-1/2 min-w-[300px] px-8 py-4 my-block rounded-lg text-center bg-light-secondary dark:bg-dark-secondary">{`오류 내용 : ${error.message}`}</p>
            <div className="w-full my-block flex justify-center items-center">
                <Button
                    innerType="text"
                    className="px-4 mx-2 bg-light-secondary dark:bg-dark-secondary"
                    onClick={reset}>
                    <span className="mr-2">다시 시도하기</span>
                    <RotateCcw size={16} />
                </Button>
                <Button
                    innerType="text"
                    className="px-4 mx-2 bg-light-secondary dark:bg-dark-secondary"
                    onClick={() => router.back()}>
                    <span className="mr-2">뒤로 가기</span>
                    <ArrowUpLeft size={16} />
                </Button>
            </div>
        </section>
    );
}