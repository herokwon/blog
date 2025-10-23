'use client';

import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { createPost } from '../api/createPost';
import { isError, type Post, type PostRequest } from '../types';

type UseCreatePostReturn = {
  create: (data: PostRequest) => Promise<Post | null>;
  isLoading: boolean;
  error: string | null;
};

export const useCreatePost = (): UseCreatePostReturn => {
  const { push } = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const timeoutRef = useRef<NodeJS.Timeout>(null);

  const create = async (data: PostRequest): Promise<Post | null> => {
    setIsLoading(true);
    setError(null);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const result = await createPost(data);

    if (isError(result)) {
      setError(result.error);
      return null;
    }

    push(`/posts/${result.data.id}`);

    timeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      timeoutRef.current = null;
    }, 200);

    return result.data;
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { create, isLoading, error };
};
