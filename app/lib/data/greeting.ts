export interface GreetingItem {
    question: string;
    answer: {
        content: string;
        imgUrl?: string;
    }[];
};

export const greetingItem: GreetingItem[] = [
    {
        question: "안녕하세요.",
        answer: [{ content: `Hi,\n I'm Hero Kwon.` }]
    },
    {
        question: "가장 좋아하는 프로그래밍 언어",
        answer: [{ content: "TypeScript", imgUrl: "https://www.typescriptlang.org/icons/icon-48x48.png?v=8944a05a8b601855de116c8a56d3b3ae" }]
    },
    {
        question: "자주 사용하는 프레임워크 3가지 ",
        answer: [
            { content: "Next.js", imgUrl: "https://nextjs.org/favicon.ico" },
            { content: "Tailwind CSS", imgUrl: "https://tailwindcss.com/favicons/favicon-32x32.png?v=3" },
            { content: "Flutter", imgUrl: "https://storage.googleapis.com/cms-storage-bucket/4fd0db61df0567c0f352.png" }]
    },
];