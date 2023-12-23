import { HTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

export default function Spinner({ ...props }: HTMLAttributes<HTMLDivElement>) {
    return (
        <div {...props} className={`w-full h-full flex justify-center items-center ${props.className ?? ""}`}>
            <Loader2 className="rotate" />
        </div>
    );
}