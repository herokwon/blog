import { HTMLAttributes } from "react";

const ButtonInner = {
    text: "text",
    icon: "icon",
} as const;
type ButtonInner = typeof ButtonInner[keyof typeof ButtonInner];

interface Button extends HTMLAttributes<HTMLButtonElement> {
    innerType: ButtonInner;
    children: React.ReactNode;
};

export default function Button({ innerType, children, ...props }: Button) {
    if (innerType === "icon") {
        return (
            <button {...props} className={`w-28 md:w-36 h-28 md:h-36 p-2 flex justify-center items-center rounded-full hover:bg-light-tertiary dark:hover:bg-dark-tertiary ${props.className ?? ""}`}>
                {children}
            </button>
         );
    }

    return (
        <button {...props} className={`px-2 py-1 flex justify-center items-center rounded-lg ${props.className ?? ""}`}>
            {children}
        </button>
    );
}