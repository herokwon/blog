import { getPost, isError, UpdatePostForm } from '@/features/Post';

export default async function Edit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const response = await getPost(id);

  if (isError(response)) throw new Error(response.error);
  const { data } = response;

  return (
    <section className="mx-auto size-full max-w-5xl py-12">
      <UpdatePostForm {...data} />
    </section>
  );
}
