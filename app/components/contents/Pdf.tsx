'use client'

import { PdfBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { useState } from "react";

import { fetchBlock } from "@/app/lib/databases";
import Spinner from "../Spinner";
import RichText from "./texts/RichText";

export default function Pdf({ block }: { block: PdfBlockObjectResponse }) {
    const { pdfUrl, pdfLoading, handlePdfLoad, handlePdfError } = usePdf(block);

    return (
        <div className="w-full my-block relative">
            {pdfLoading ? <Spinner className="absolute top-0 left-0 z-10" /> : null}
            <iframe
                className="article-content--embed"
                src={pdfUrl}
                title="PDF Reader"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                onLoad={handlePdfLoad}
                onError={handlePdfError}>
                <p className="article-content--caption">iframe을 지원하지 않는 브라우저입니다.</p>
            </iframe>
            <div className="article-content--caption">
                <RichText richTexts={block.pdf.caption} />
            </div>
        </div>
    );
}

const usePdf = (block: PdfBlockObjectResponse) => {
    const pdfData = getPdf(block);
    const [pdfUrl, setPdfUrl] = useState<string>(pdfData.url);
    const [pdfLoading, setPdfLoading] = useState<boolean>(true);

    const handlePdfLoad = () => {
        const load = setTimeout(() => {
            setPdfLoading(false);
            clearTimeout(load);
        }, 500);
    };

    const handlePdfError = async () => {
        setPdfLoading(true);

        if (!pdfData.expiring) {
            setPdfUrl("");
            setPdfUrl(pdfData.url);
        } else {
            const response = await fetchBlock(block.id);
            const { url } = getPdf(response.block as PdfBlockObjectResponse);
            setPdfUrl(url);
        }
    };

    return { pdfUrl, pdfLoading, handlePdfLoad, handlePdfError };
};

const getPdf = (block: PdfBlockObjectResponse): { url: string; expiring: boolean; } => {
    switch (block.pdf.type) {
        case "external":
            return {
                url: block.pdf.external.url,
                expiring: false,
            };
        case "file":
            return {
                url: block.pdf.file.url,
                expiring: true,
            };
    }
};