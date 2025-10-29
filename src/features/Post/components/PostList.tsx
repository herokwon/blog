'use client';

import { use } from 'react';

import Link from 'next/link';

import { getPost, getPosts } from '../api';
import { isError } from '../types';

type PostListProps = {
  postsPromise: ReturnType<typeof getPosts>;
};

type PostItemProps = {
  postPromise: ReturnType<typeof getPost>;
};

export const PostList = ({ postsPromise }: PostListProps) => {
  const result = use(postsPromise);

  if (isError(result)) throw new Error(result.error);

  return (
    <ul>
      {result.data.map(id => (
        <PostItem key={id} postPromise={getPost(id)} />
      ))}
    </ul>
  );
};

const PostItem = ({ postPromise }: PostItemProps) => {
  const result = use(postPromise);

  if (isError(result)) throw new Error(result.error);

  return (
    <Link href={`/posts/${result.data.id}`}>
      <h2>{result.data.title}</h2>
      <p>{result.data.content}</p>
    </Link>
  );
};
