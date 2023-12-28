import { StaticImport } from "next/dist/shared/lib/get-img-props";

import ImageHeader from "./ImageHeader";

interface PageHeader {
    imageSrc?: string | StaticImport;
    title?: string;
    children: React.ReactNode;
};

export default function PageHeader({ imageSrc, title, children }: PageHeader) {
    return (
        <section className="w-full h-[75vh] mb-4 relative">
            {imageSrc ? <ImageHeader imageSrc={imageSrc} title={title} /> : null}
            <div className="w-full h-full text-dark absolute top-0 left-0 z-10">
                {children}
            </div>
        </section>
    );
}