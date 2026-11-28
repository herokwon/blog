import type { PageServerLoad } from './$types';
import { loadPostList } from './post-list.server';

export const load = (({ url }) => loadPostList(url)) satisfies PageServerLoad;
