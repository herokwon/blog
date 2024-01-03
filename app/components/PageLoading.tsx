import Spinner from "./Spinner";

export default function PageLoading() {
    return (
        <div className="page-loading w-screen h-screen fixed top-0 left-0 z-[999]">
            <Spinner className="first:scale-150" />
        </div>
    );
}