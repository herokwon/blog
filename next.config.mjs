/** @type {import('next').NextConfig} */

import withPlaiceholder from "@plaiceholder/next";

const nextConfig = {
    images: {
        imageSizes: [16, 32, 64, 128, 256],
        deviceSizes: [512, 768, 1024, 1280, 1920],
        dangerouslyAllowSVG: true,
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
    webpack(config) {
        config.module.rules.push({
          test: /\.svg$/i,
          use: ['@svgr/webpack'],
        })
    
        return config
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

export default withPlaiceholder(nextConfig);