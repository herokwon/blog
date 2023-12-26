'use client'

import { VideoBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { useState } from "react";

import { fetchBlock } from "@/app/lib/databases";
import RichText from "./texts/RichText";
import Spinner from "../Spinner";

export default function Video({ block }: { block: VideoBlockObjectResponse }) {
    const { videoUrl, videoLoading, handleVideoLoad, handleVideoError } = useVideo(block);

    return (
        <div className="w-full my-block relative">
            {videoLoading ? <Spinner className="absolute top-0 left-0 z-10" /> : null}
            {block.video.type === "external" ?
                <iframe
                    className="article-content--video"
                    src={videoUrl}
                    title="Video Player"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    onLoad={handleVideoLoad}
                    onError={handleVideoError}>
                    <p className="article-content--caption">iframe을 지원하지 않는 브라우저입니다.</p>
                </iframe> :
                <video
                    playsInline
                    preload="metadata"
                    className="article-content--video"
                    src={videoUrl}
                    onLoad={handleVideoLoad}
                    onError={handleVideoError} />}

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

        if (!video.expiring) return;

        const response = await fetchBlock(block.id);
        const updatedVideoData = getVideo(response.block as VideoBlockObjectResponse);

        setVideoUrl(updatedVideoData.url);
    };

    const handleVideoLoad = () => {
        const load = setTimeout(() => {
            setVideoLoading(false);
            clearTimeout(load);
        }, 500);
    };

    return { videoUrl, videoLoading, handleVideoLoad, handleVideoError };
};

const getVideo = (block: VideoBlockObjectResponse) => {
    switch (block.video.type) {
        case "external":
            const externalUrl = block.video.external.url;

            return {
                url: externalUrl.includes("youtube") && externalUrl.includes("watch?v=") ? externalUrl.replace("watch?v=", "embed/") : externalUrl,
                expiring: false,
            };
        case "file":
            return {
                url: block.video.file.url,
                expiring: true,
            };
    }
};