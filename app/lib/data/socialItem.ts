import { IconDefinition, faGithub, faInstagram, faLinkedin } from "@fortawesome/free-brands-svg-icons";

interface SocialItem {
    path: string;
    icon: IconDefinition;
    content: string;
};

export const socialItem: SocialItem[] = [
    { path: "github.com/herokwon", icon: faGithub, content: "@herokwon" },
    { path: "instagram.com/herokwon", icon: faInstagram, content: "@herokwon" },
    { path: "linkedin.com/in/herokwon", icon: faLinkedin, content: "@herokwon" },
];