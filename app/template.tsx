'use client'

import { usePathname } from "next/navigation";
import { AnimatePresence, Variants, motion } from "framer-motion";

export default function Template({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

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
        transform: 'translateY(50px)',
        transitionProperty: 'transform',
        transitionDuration: '300ms',
        transitionTimingFunction: 'ease',
    },
    enter: {
        opacity: 1,
        transform: 'translateY(0)',
        transitionProperty: 'transform',
        transitionDuration: '300ms',
        transitionTimingFunction: 'ease',
    },
    exit: {
        opacity: 0,
        transform: 'translateY(50px)',
        transitionProperty: 'transform',
        transitionDuration: '300ms',
        transitionTimingFunction: 'ease',
    }
};