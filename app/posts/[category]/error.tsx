'use client'

import Button from "@/app/components/Button";
import { RotateCcw } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
    return (
        <section className="w-full h-full min-h-screen flex flex-col justify-center items-center">
            <h1 className="line-heading font-extrabold text-[2rem]">Error</h1>
            <p className="">Category Pages</p>
            <hr className="w-1/2 min-w-[300px] border-[var(--light-)] my-4" />
            <div className="my-4">
                <Button innerType="text" className="bg-light-tertiary dark:bg-dark-tertiary" onClick={reset}>
                    <span className="mx-2">다시 시도하기</span><RotateCcw size={16} />
                </Button>
            </div>
        </section>
    );
}