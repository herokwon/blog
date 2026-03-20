import type { components } from '$lib/types/schema';
import type { Camelify } from '$lib/types/utils';

type SchemaPost = components['schemas']['Post'];

export type DBPost = SchemaPost;
export type Post = Camelify<SchemaPost>;
export type PostInput = components['schemas']['PostInput'];

/**
 * Transforms a database row (snake_case) to application format (camelCase)
 * @param dbPost The database post object to transform
 * @returns The transformed post object in application format
 */
export function dbPostToPost(dbPost: DBPost): Post {
  return {
    id: dbPost.id,
    title: dbPost.title,
    content: dbPost.content,
    createdAt: dbPost.created_at,
    updatedAt: dbPost.updated_at,
  };
}

/**
 * Transforms application format (camelCase) to database format (snake_case)
 * @param post The post object in application format to transform
 * @returns The transformed post object in database format
 */
export function postToDbPost(post: Post): DBPost {
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    created_at: post.createdAt,
    updated_at: post.updatedAt,
  };
}
