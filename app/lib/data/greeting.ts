import { StaticImageData } from "next/image";

import TsIcon from "@/public/icons/typescript.svg";
import NextIcon from "@/public/icons/nextjs.svg";
import TailwindIcon from "@/public/icons/tailwindcss.svg";
import FlutterIcon from "@/public/icons/flutter.svg";

export interface GreetingItem {
    question: string;
    answer: {
        content: string;
        imgSrc?: StaticImageData;
    }[];
};

export const greetingItem: GreetingItem[] = [
    {
        question: "안녕하세요.",
        answer: [{ content: `Hi,\n I'm Hero Kwon.` }]
    },
    {
        question: "가장 좋아하는 프로그래밍 언어",
        answer: [{ content: "TypeScript", imgSrc: TsIcon }]
    },
    {
        question: "자주 사용하는 프레임워크 3가지 ",
        answer: [
            { content: "Next.js", imgSrc: NextIcon },
            { content: "Tailwind CSS", imgSrc: TailwindIcon },
            { content: "Flutter", imgSrc: FlutterIcon }]
    },
];