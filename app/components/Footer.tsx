import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Mail } from "lucide-react";
import Link from "next/link";

import { socialItem } from "../lib/data/socialItem";
import ThreeModelViewer from "./intros/ThreeModelViewer";
import Section from "./Section";

export default function Footer() {
    const email = process.env.NEXT_PUBLIC_CONTACT!;

    return (
        <footer id="main-footer" className="w-full py-8 bg-light-secondary dark:bg-dark-secondary">
            <Section innerProps={{ className: "grid grid-cols-1 sm:grid-cols-2" }}>
                <div className="w-full h-full">
                    <ThreeModelViewer />
                </div>
                <div className="w-full h-full py-4 flex items-center">
                    <div className="w-fit mx-auto my-4 grid grid-rows-[repeat(auto-fit,_minmax(0,_1fr))] gap-y-4">
                        {socialItem.map((item) =>
                            <Link
                                key={item.path}
                                target="_blank"
                                href={`https://${item.path}`}
                                className="social-item">
                                <FontAwesomeIcon icon={item.icon} size="xl" className="social-item--icon" />
                                <span className="social-item--content">{item.content}</span>
                            </Link>
                        )}
                        <Link
                            target="_blank"
                            href={`mailto:${email}`}
                            className="social-item">
                            <Mail className="social-item--icon" />
                            <span className="social-item--content">{email}</span>
                        </Link>
                    </div>
                </div>
                <section>
                </section>
            </Section>
        </footer>
    );
}