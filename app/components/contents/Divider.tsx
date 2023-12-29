import { HTMLAttributes } from "react";

type DividerProps = Pick<HTMLAttributes<HTMLHRElement>, "className">;

export default function Divider({ className }: DividerProps) {
    return (
        <hr className={`w-full border-[1.5px] border-light-tertiary dark:border-dark-tertiary ${className ?? ""}`} />
    );
}