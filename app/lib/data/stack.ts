import JsIcon from "@/public/icons/javascript.svg";
import TsIcon from "@/public/icons/typescript.svg";
import NextIcon from "@/public/icons/nextjs.svg";
import TailwindIcon from "@/public/icons/tailwindcss.svg";
import FlutterIcon from "@/public/icons/flutter.svg";

export const StackType = {
    language: "language",
    framework: "framework",
    library: "library",
} as const;
type StackType = typeof StackType[keyof typeof StackType];

type StackItem = {
    [type in StackType]: {
        name: string;
        icon: React.FC<React.SVGProps<SVGSVGElement>>;
    }[];
};

export const stackItem: StackItem = {
    language: [
        { name: "JavaScript", icon: JsIcon },
        { name: "TypeScript", icon: TsIcon },
    ],
    framework: [
        { name: "Next.js", icon: NextIcon },
        { name: "Tailwind CSS", icon: TailwindIcon },
        { name: "Flutter", icon: FlutterIcon },
    ],
    library: [],
}