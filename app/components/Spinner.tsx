import { HTMLAttributes } from "react";

import { Loader2 } from "lucide-react";

type SpinnerClassName = Pick<HTMLAttributes<HTMLDivElement>, "className">;

export default function Spinner({ className }: SpinnerClassName) {
    return (
        <div className={`w-full h-full flex justify-center items-center ${className ?? ""}`}>
            <Loader2 className="rotation" />
        </div>
    );
}