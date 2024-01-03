'use client'

import { VideoBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { useState } from "react";

import { getVideo } from "@/app/lib/functions/notion";
import { fetchBlock } from "@/app/lib/databases";
import Spinner from "../Spinner";
import RichText from "./texts/RichText";

export default function FileVideo({ block }: { block: VideoBlockObjectResponse; videoData: { url: string; expiring: boolean; } }) {
    const { videoUrl, videoLoading, handleVideoLoad, handleVideoError } = useVideo(block);

    return (
        <div className="w-full my-block relative">
            {videoLoading ?
                <Spinner className="absolute top-0 left-0 z-10" /> : null}
            <video
                controls
                controlsList="nodownload"
                playsInline
                preload="metadata"
                src={videoUrl}
                className="article-content--video"
                onLoadedData={handleVideoLoad}
                onError={handleVideoError} />
            <div className="article-content--caption">
                <RichText richTexts={block.video.caption} />
            </div>
        </div>
    );
}

const useVideo = (block: VideoBlockObjectResponse) => {
    const video = getVideo(block);
    const [videoUrl, setVideoUrl] = useState<string>(video.url);
    const [videoLoading, setVideoLoading] = useState<boolean>(true);

    const handleVideoError = async () => {
        setVideoLoading(true);

        if (!video.expiring) {
            setVideoUrl("");
            setVideoUrl(video.url);
        } else {
            const response = await fetchBlock(block.id);
            const { url } = getVideo(response.block as VideoBlockObjectResponse);
            setVideoUrl(url);
        }
    };

    const handleVideoLoad = () => {
        const load = setTimeout(() => {
            setVideoLoading(false);
            clearTimeout(load);
        }, 500);
    };

    return { videoUrl, videoLoading, handleVideoLoad, handleVideoError };
};