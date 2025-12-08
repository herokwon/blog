import { getPosts, isError, PostList } from '@/features/Post';

export const dynamic = 'force-dynamic';

export default async function Posts() {
  const response = await getPosts();

  if (isError(response)) throw new Error(response.error);

  const { data: posts } = response;

  return <PostList posts={posts} />;
}
