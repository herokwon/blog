export interface Post {
  id: ReturnType<typeof crypto.randomUUID>;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export type CreatePostInput = Pick<Post, 'title' | 'content'>;
export type UpdatePostInput = Omit<Post, 'id' | 'createdAt'>;
