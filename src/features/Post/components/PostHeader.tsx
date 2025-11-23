'use client';

import { useRouter } from 'next/navigation';

import type { StrictOmit } from '@supabase/supabase-js';

import { removePost } from '../api';
import { isError, type Post } from '../types';
import { RemoveButton, UpdateButton } from './PostButton';

type PostHeaderProps = StrictOmit<Post, 'content'> & {
  isAdmin: boolean;
};

export const PostHeader = ({
  isAdmin,
  id,
  title,
  created_at,
  updated_at,
}: PostHeaderProps) => {
  const formattedCreatedAt = new Date(created_at).toLocaleDateString();
  const formattedUpdatedAt = new Date(updated_at).toLocaleDateString();

  const { push } = useRouter();

  const handleUpdate = () => {
    push(`/posts/${id}/edit`);
  };

  const handleRemove = async () => {
    if (!confirm('게시글을 삭제하시겠습니까?')) return;

    const result = await removePost(id);
    if (isError(result)) {
      alert(`게시글 삭제에 실패했습니다: ${result.error}`);
      return;
    }

    push('/posts');
  };

  return (
    <header className="">
      <h1>{title}</h1>
      <div className="inline-flex flex-col text-sm opacity-60">
        <time dateTime={created_at}>{formattedCreatedAt}</time>
        {created_at !== updated_at && (
          <time dateTime={updated_at}>{`(${formattedUpdatedAt} 수정됨)`}</time>
        )}
      </div>
      {isAdmin && (
        <div className="flex">
          <UpdateButton onClick={handleUpdate} />
          <RemoveButton onClick={handleRemove} />
        </div>
      )}
    </header>
  );
};
