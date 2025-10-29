export * from './guards';

export type Post = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  content: string;
};

export type PostRequest = Pick<Post, 'title' | 'content'>;

export type CreatePostResponse =
  | {
      data: Post;
      error: null;
    }
  | {
      data: null;
      error: string;
    };
export type UpdatePostResponse =
  | {
      data: Post;
      error: null;
    }
  | {
      data: null;
      error: string;
    };
export type RemovePostResponse =
  | {
      success: true;
      error: null;
    }
  | {
      success: false;
      error: string;
    };

export type GetPostsResponse =
  | {
      data: string[];
      error: null;
    }
  | {
      data: null;
      error: string;
    };
