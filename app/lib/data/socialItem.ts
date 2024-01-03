import { IconDefinition, faGithub, faInstagram, faLinkedin } from "@fortawesome/free-brands-svg-icons";

interface SocialItem {
    path: string;
    icon: IconDefinition;
    content: string;
};

const author = process.env.NEXT_PUBLIC_AUTHOR!;

export const socialItem: SocialItem[] = [
    { path: `github.com/${author}`, icon: faGithub, content: `@${author}` },
    { path: `instagram.com/hero__kwon`, icon: faInstagram, content: `@${author}` },
    { path: `linkedin.com/in/${author}`, icon: faLinkedin, content: `@${author}` },
];