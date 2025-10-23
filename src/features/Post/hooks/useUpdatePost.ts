'use client';

import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { updatePost } from '../api/updatePost';
import { isError, type Post, type PostRequest } from '../types';

type UseUpdatePostReturn = {
  update: (data: PostRequest) => Promise<Post | null>;
  isLoading: boolean;
  error: string;
};

export const useUpdatePost = (id: string): UseUpdatePostReturn => {
  const { push } = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const timeoutRef = useRef<NodeJS.Timeout>(null);

  const update = async (data: PostRequest): Promise<Post | null> => {
    setIsLoading(true);
    setError('');

    const result = await updatePost({ id, ...data });

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

  return { update, isLoading, error };
};
