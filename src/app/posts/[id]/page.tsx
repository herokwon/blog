import { getPost, isError, PostContent, PostHeader } from '@/features/Post';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Post({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPost(id);

  if (isError(post)) throw new Error(post.error);
  const { content, ...rest } = post.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <article className="space-y-8">
      <PostHeader isAdmin={!!user} {...rest} />
      <hr className="border-slate-200" />
      <section>
        <PostContent content={content} />
      </section>
    </article>
  );
}
