'use client'

import { Dispatch, SetStateAction, useEffect, useRef } from "react";

import { Headings } from "../types/notion";

export const useToc = (headings: Headings[], setActiveId: Dispatch<SetStateAction<string>>) => {
    const headingElementsRef = useRef<any>({});

    useEffect(() => {
        headingElementsRef.current = {};

        const callback: IntersectionObserverCallback = (headings) => {
            headingElementsRef.current = headings.reduce((map: any, headingElement) => {
                map[headingElement.target.id] = headingElement;
                return map;
            }, headingElementsRef.current);

            const visibleHeadings: IntersectionObserverEntry[] = [];
            Object.keys(headingElementsRef.current).forEach((key) => {
                const headingElement = headingElementsRef.current[key];

                if (headingElement.isIntersecting) visibleHeadings.push(headingElement);
            });

            const getIndexFormId = (id: string) => headingElements.findIndex((heading) => heading.id === id);

            if (visibleHeadings.length === 1) {
                setActiveId(visibleHeadings[0].target.id);
            } else if (visibleHeadings.length > 1) {
                const sortedVisibleHeadings = visibleHeadings.sort((a, b) => getIndexFormId(a.target.id) - getIndexFormId(b.target.id));
                setActiveId(sortedVisibleHeadings[0].target.id);
            }
        };

        const observer = new IntersectionObserver(callback, {
            rootMargin: '0px 0px -40% 0px'
        });

        const headingElements: HTMLHeadingElement[] = Array.from(document.body.querySelector(".article-content")!.querySelectorAll('h1, h2, h3'));
        headingElements.forEach((element) => observer.observe(element));

        return () => observer.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [headings]);
};