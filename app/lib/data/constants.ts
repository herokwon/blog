export const BASE_URL =
    process.env.NODE_ENV === "development" ?
        'http://localhost:3000' : process.env.NEXT_PUBLIC_SITE_URL!;