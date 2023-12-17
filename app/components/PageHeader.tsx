export default function PageHeader({ title, children }: { title?: string; children: React.ReactNode }) {
    return (
        <section className="w-full h-[75vh] mb-4 relative">
            <div className="w-full h-full absolute top-0 left-0 z-0 bg-dark-secondary">
                {children}
            </div>
            {title &&
                <div className="w-full my-4 absolute bottom-0 left-0 z-[1]">
                    <h1 className="text-center text-dark">{title}</h1>
                </div>}
        </section>
    );
}