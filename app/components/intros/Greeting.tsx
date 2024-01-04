'use client'

import { MouseEvent, useEffect, useState } from "react";
import Image from "next/image";

import { GreetingItem, greetingItem } from "@/app/lib/data/greeting";
import Character from "@/public/images/character.png";
import Button from "../Button";

export default function Greeting() {
    const [currentContent, setCurrentContent] = useState<GreetingItem>({
        question: greetingItem[0].question, answer: greetingItem[0].answer
    });

    const handleClickGreetingItem = (e: MouseEvent) => {
        const target = e.currentTarget as HTMLButtonElement;
        const targetQuestion = target.title;
        const targetAnswer = greetingItem.find((item) => item.question === targetQuestion)?.answer;

        if (targetAnswer) {
            setCurrentContent({ question: targetQuestion, answer: targetAnswer });
        } else {
            setCurrentContent({ question: greetingItem[0].question, answer: greetingItem[0].answer });
        }
    };

    useEffect(() => {
        if (window.scrollY === 0) return;

        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
    }, [currentContent]);

    return (
        <section className="intro-container--greeting relative">
            <div className="w-full max-w-[280px] min-[864px]:max-w-[320px] h-max aspect-[5/4] min-[864px]:mx-4 max-[864px]:my-4 flex justify-center items-center transition-all duration-200 relative z-10">
                <svg className="w-full h-full absolute top-0 left-0 z-0">
                    <ellipse cx="50%" cy="50%" rx="50%" ry="50%"
                        className="transition-all duration-200 absolute top-0 left-0 z-0" />
                </svg>
                <div className="w-full text-[1.48rem] text-center font-nunito font-semibold whitespace-pre absolute top-1/2 left-0 -translate-y-1/2 z-[1]">
                    {currentContent.answer.map((item, index) =>
                        <p key={index} className="w-full my-2 flex justify-center items-center">
                            {item.imgSrc ?
                                <Image
                                    src={item.imgSrc}
                                    width={40}
                                    height={40}
                                    className="rounded-full"
                                    alt="greeting-image" /> : null}
                            {item.content}
                        </p>)}
                </div>
            </div>
            <div className="intro-focus-background w-full h-full min-[864px]:mx-4 max-[864px]:my-4 transition-all duration-200 relative z-0"
                style={{ maxWidth: `${Character.width}px`, aspectRatio: `${Character.width} / ${Character.height}` }}>
                <Image
                    src={Character}
                    fill
                    sizes="(max-width: 512px) 100vw, 480px"
                    placeholder="blur"
                    alt="character-image" />
            </div>
            <div className="w-full max-w-[480px] absolute bottom-[25%] left-1/2 min-[864px]:left-0 max-[864px]:-translate-x-1/2 z-[99]">
                {greetingItem.map((item, index) =>
                    <Button
                        key={index}
                        innerType="text"
                        title={item.question}
                        className={`greeting-item ${item.question === currentContent.question ? "selected" : ""}`}
                        onClick={handleClickGreetingItem}>
                        {item.question}
                    </Button>)}
            </div>
        </section>
    );
}