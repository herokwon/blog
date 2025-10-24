'use client';

import { PostForm, PublishButton, useCreatePost } from '@/features/Post';

export default function Write() {
  const { create } = useCreatePost();

  return (
    <section className="mx-auto size-full max-w-5xl py-12">
      <PostForm onSubmit={create}>
        <PublishButton />
      </PostForm>
    </section>
  );
}
