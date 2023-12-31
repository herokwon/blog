import { HTMLAttributes } from "react";

interface Section {
    wrapperProps?: HTMLAttributes<HTMLElement>;
    innerProps?: HTMLAttributes<HTMLDivElement>;
    children: React.ReactNode;
};

export default function Section({ wrapperProps, innerProps, children }: Section) {
    return (
        <section {...wrapperProps} className={`section-wrapper ${wrapperProps?.className ?? ""}`}>
            <div {...innerProps} className={`section-inner ${innerProps?.className ?? ""}`}>
                {children}
            </div>
        </section>
    );
}