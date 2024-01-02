import { navItem } from "../lib/data/navItem";
import PageHeader from "../components/PageHeader";

import ProjectImage from "@/public/images/projects.png";

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
    return (
        <main className="main-wrapper">
            <PageHeader imageSrc={ProjectImage}>
                <div className="w-full my-4 absolute bottom-0 left-0 z-[1]">
                    <h1 className="text-center text-dark">
                        {navItem.at(-1)?.title}
                    </h1>
                </div>
            </PageHeader>
            {children}
        </main>
    );
}