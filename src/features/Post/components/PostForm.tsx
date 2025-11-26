'use client';

import { useEffect, useState } from 'react';

import { EditorShell } from '@/features/Editor';

import type { Post, PostRequest } from '../types';

const EMPTY_POST: PostRequest = {
  title: '',
  content: '',
};

type PostFormProps = Omit<React.ComponentPropsWithRef<'form'>, 'onSubmit'> & {
  initialData?: PostRequest;
  isLoading?: boolean;
  onChangeData?: (data: PostRequest) => void;
  onSubmit: (data: PostRequest) => Promise<Post | null>;
};

export const PostForm = ({
  children,
  initialData = EMPTY_POST,
  onChangeData,
  onSubmit,
  ...props
}: PostFormProps) => {
  const [post, setPost] = useState<PostRequest>({
    ...initialData,
  });

  const handleChange = (data: PostRequest) => {
    setPost(data);
    onChangeData?.(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(post);
  };

  useEffect(() => {
    setPost({ ...initialData });
  }, [initialData]);

  return (
    <form
      {...props}
      role="form"
      onSubmit={handleSubmit}
      className={`flex size-full grid-rows-[min-content_minmax(0,1fr)] flex-col gap-y-4 ${props.className ?? ''}`}
    >
      {children && <div className="mr-0 ml-auto">{children}</div>}
      <input
        id="title"
        name="title"
        value={post.title}
        placeholder="제목"
        className="w-full shrink-0 rounded px-4 py-3 font-bold ring-1 ring-slate-200 outline-none"
        onChange={e => handleChange({ ...post, title: e.target.value })}
      />
      <EditorShell
        className="min-h-0 flex-1"
        value={post.content}
        onChangeValue={newContent =>
          handleChange({ ...post, content: newContent })
        }
      />
    </form>
  );
};
