'use server'

import { cookies } from "next/headers";

const BlogTheme = {
    light: "light",
    dark: "dark",
} as const;
export type BlogTheme = typeof BlogTheme[keyof typeof BlogTheme];

export const getTheme = async () => {
    return cookies().get("All_of_IT__theme")?.value as BlogTheme | undefined;
};

export const updateTheme = async (theme: BlogTheme) => {
    const expiredTime = 60 * 60 * 24 * 30 * 12;
    cookies().set("All_of_IT__theme", theme, { httpOnly: true, maxAge: expiredTime, expires: 1000 * expiredTime });
};