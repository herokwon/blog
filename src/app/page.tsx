import { getPosts, isError, PostList } from '@/features/Post';

export default async function Home() {
  const response = await getPosts(5);

  if (isError(response)) throw new Error(response.error);
  const { data: posts } = response;

  return <PostList posts={posts} />;
}
