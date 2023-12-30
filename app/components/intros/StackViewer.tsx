import { StackType, stackItem } from "@/app/lib/data/stack";

export default function StackViewer() {
    return (
        <section className="intro-container stack-viewer">
            {Object.keys(stackItem).map((stackType: keyof typeof StackType, index) => {
                if (stackItem[stackType].length === 0) return null;

                return (
                    <div key={index} className="w-full py-4 my-block">
                        <h2 className="text-center">{stackType[0].toUpperCase() + stackType.slice(1)}</h2>
                        <div className="w-full my-block grid grid-cols-[repeat(auto-fit,_minmax(auto,_120px))] gap-x-8 gap-y-4 justify-center items-center">
                            {stackItem[stackType].map((item, index) =>
                                <div key={index} className="stack-container">
                                    <item.icon />
                                    <span>{item.name}</span>
                                </div>)}
                        </div>
                    </div>
                );
            })}
        </section>
    );
}