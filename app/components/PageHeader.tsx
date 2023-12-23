import ImageHeader from "./ImageHeader";

interface PageHeader {
    imageUrl?: string;
    title?: string;
    children: React.ReactNode;
};

export default function PageHeader({ imageUrl, title, children }: PageHeader) {
    return (
        <section className="w-full h-[75vh] mb-4 relative">
            {imageUrl ? <ImageHeader imageUrl={imageUrl} title={title} /> : null}
            <div className="w-full h-full text-dark absolute top-0 left-0 z-10">
                {children}
            </div>
        </section>
    );
}