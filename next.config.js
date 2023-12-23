/** @type {import('next').NextConfig} */

const nextConfig = {
    images: {
        imageSizes: [48, 64, 96, 128, 256, 384],
        deviceSizes: [640, 750, 828, 1080, 1200, 1920],
        remotePatterns: [
            {
                protocol: "https",
                hostname: "prod-files-secure.s3.us-west-2.amazonaws.com"
            }
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