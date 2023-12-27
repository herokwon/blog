import { HTMLAttributes, MouseEventHandler } from "react";
import Button from "./Button";

type SidebarBtnProps = Pick<HTMLAttributes<HTMLButtonElement>, "className" | "onClick">;

export default function SidebarBtn({ className, onClick }: SidebarBtnProps) {
    return (
        <Button
            innerType="text"
            className={`sidebar-btn ${className ?? ""}`}
            onClick={onClick}>
            <div>
                <span />
                <span />
                <span />
            </div>
        </Button>
    );
}