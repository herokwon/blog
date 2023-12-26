/** @type {import('next').NextConfig} */

const nextConfig = {
    images: {
        imageSizes: [16, 32, 64, 128, 256],
        deviceSizes: [512, 768, 1024, 1280, 1920],
        remotePatterns: [
            {
                protocol: "https",
                hostname: "prod-files-secure.s3.us-west-2.amazonaws.com"
            },
            {
                protocol: "https",
                hostname: "images.unsplash.com",
            },
        ],
    },
    experimental: {
        turbo: {
            rules: {
                '*.svg': {
                    loaders: ['@svgr/webpack'],
                    as: '*.js',
                },
            }
        }
    }
};

module.exports = nextConfig;