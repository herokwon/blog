import { ToDoBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import RichText from "./texts/RichText";

export default function ToDo({ block }: { block: ToDoBlockObjectResponse }) {
    return (
        <div className="w-full flex items-center">
            <input
                className="mr-2"
                type="checkbox"
                defaultChecked={block.to_do.checked}
                checked={block.to_do.checked} />
            <RichText richTexts={block.to_do.rich_text} />
        </div>
    );
}