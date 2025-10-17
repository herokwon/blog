import { EditorShell } from '@/features/Editor';
import { BookPlus } from 'lucide-react';

export default function Write() {
  return (
    <section className="mx-auto grid size-full max-w-5xl grid-rows-[min-content_minmax(0,_1fr)] gap-y-4 py-12">
      <div>
        <button
          type="button"
          className="mr-0 ml-auto flex cursor-pointer items-center gap-x-2 rounded bg-indigo-500 px-3 py-1 font-semibold text-white hover:bg-indigo-600 active:bg-indigo-700"
        >
          <BookPlus size={16} />
          발행
        </button>
      </div>
      <article className="flex flex-col gap-y-4">
        <input
          id="title"
          name="title"
          placeholder="제목"
          className="w-full flex-shrink-0 rounded px-4 py-3 font-bold ring-1 ring-slate-200 outline-none"
        />
        <EditorShell className="min-h-0 flex-1" />
      </article>
    </section>
  );
}
