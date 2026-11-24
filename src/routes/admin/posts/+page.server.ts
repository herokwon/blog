import { listPosts } from '../../../lib/server/db/posts';
import { env } from '../../../lib/server/runtime';

export const load = async () => ({ posts: await listPosts(env.DB) });
