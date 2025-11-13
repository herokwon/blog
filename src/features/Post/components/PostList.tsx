import Link from 'next/link';

import { extractTextNodes } from '@/features/Editor';

import type { Post } from '../types';

export const PostList = ({ posts }: { posts: Post[] }) => {
  return (
    <section data-testid="post-list">
      {posts.map(({ ...post }) => (
        <article
          key={post.id}
          data-testid="post-item-wrapper"
          className="flex w-full"
        >
          <PostItem key={post.id} {...post} />
        </article>
      ))}
    </section>
  );
};

const parseContentText = (content: string): string => {
  const textNodes = extractTextNodes(content);
  let previewText = '';

  for (const node of textNodes) {
    if (previewText.length >= 200) break;
    previewText += node.text.trim() + ' ';
  }

  return previewText.trim();
};

const PostItem = ({ ...item }: Post) => {
  const formattedCreatedAt = new Date(item.created_at).toLocaleDateString();
  const previewText = parseContentText(item.content);

  return (
    <Link
      href={`/posts/${item.id}`}
      data-testid="post-item"
      className="flex w-full flex-col gap-y-1"
    >
      <h2>{item.title}</h2>
      <p className="line-clamp-3">{previewText}</p>
      <time dateTime={formattedCreatedAt} className="text-sm opacity-60">
        {formattedCreatedAt}
      </time>
    </Link>
  );
};
