'use client'

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, Variants, motion } from "framer-motion";

import { isProd, GA_ID } from "./lib/data/constants";

export default function Template({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    useEffect(() => {
        if (window.scrollY > 0) {
            window.scrollTo({
                top: 0,
                behavior: 'smooth',
            });
        }
    }, [pathname]);

    useEffect(() => {
        if (isProd) {
            window.gtag('config', GA_ID, {
                page_title: window.document.title,
                page_location: window.location.href,
                page_path: pathname,
            });
        }
    }, [pathname]);

    return (
        <AnimatePresence>
            <motion.div
                key={pathname}
                id="wrapper"
                variants={variants}
                initial="initial"
                animate="enter"
                exit="exit">
                {children}
            </motion.div>
        </AnimatePresence>
    );
}

const variants: Variants = {
    initial: {
        opacity: 0,
        marginTop: '50px',
        transitionProperty: 'margin',
        transitionDuration: '300ms',
        transitionTimingFunction: 'ease',
    },
    enter: {
        opacity: 1,
        marginTop: '0px',
        transitionProperty: 'margin',
        transitionDuration: '300ms',
        transitionTimingFunction: 'ease',
    },
    exit: {
        opacity: 0,
        marginTop: '50px',
        transitionProperty: 'margin',
        transitionDuration: '300ms',
        transitionTimingFunction: 'ease',
    }
};