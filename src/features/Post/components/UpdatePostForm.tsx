'use client';

import { useUpdatePost } from '../hooks';
import type { Post } from '../types';
import { UpdateButton } from './PostButton';
import { PostForm } from './PostForm';

type UpdatePostFormProps = Pick<Post, 'id' | 'title' | 'content'>;

export const UpdatePostForm = ({ id, ...initialData }: UpdatePostFormProps) => {
  const { update } = useUpdatePost(id);

  return (
    <PostForm initialData={initialData} onSubmit={update}>
      <UpdateButton />
    </PostForm>
  );
};
