export default function ExternalVideo({ videoData }: { videoData: { url: string; expiring: boolean; } }) {
    return (
        <iframe className="article-content--video"
            src={videoData.url}
            title="Video Player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen>
            <p className="article-content--caption">iframe을 지원하지 않는 브라우저입니다.</p>
        </iframe>
    );
}