export interface Post {
  id: ReturnType<typeof crypto.randomUUID>;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}
