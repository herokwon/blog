'use client';

import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { removePost } from '../api/removePost';

type UseRemoveReturn = {
  remove: (id: string) => Promise<boolean>;
  isLoading: boolean;
  error: string;
};

export const useRemovePost = (): UseRemoveReturn => {
  const { push } = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const timeoutRef = useRef<NodeJS.Timeout>(null);

  const remove = async (id: string): Promise<boolean> => {
    setIsLoading(true);
    setError('');

    const result = await removePost(id);

    if (!result.success) {
      setError(result.error);
      return false;
    }

    push('/posts');

    timeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      timeoutRef.current = null;
    }, 200);

    return true;
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { remove, isLoading, error };
};
