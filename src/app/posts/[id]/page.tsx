import { getPost, isError, PostContent } from '@/features/Post';

export default async function Post({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPost(id);

  if (isError(post)) throw new Error(post.error);

  const { title, content, created_at, updated_at } = post.data;

  const formattedCreatedAt = new Date(created_at).toLocaleDateString();
  const formattedUpdatedAt = new Date(updated_at).toLocaleDateString();

  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <h1>{title}</h1>
        <div className="inline-flex flex-col text-sm opacity-60">
          <time dateTime={created_at}>{formattedCreatedAt}</time>
          {created_at === updated_at && (
            <time
              dateTime={updated_at}
            >{`(${formattedUpdatedAt} 수정됨)`}</time>
          )}
        </div>
      </header>
      <hr className="border-slate-200" />
      <section>
        <PostContent content={content} />
      </section>
    </article>
  );
}
