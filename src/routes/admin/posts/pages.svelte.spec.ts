import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

import PublicDetailPage from '../../(public)/posts/[id]/+page.svelte';
import TrashPage from '../trash/+page.svelte';
import DetailPage from './[id]/+page.svelte';
import EditPage from './[id]/edit/+page.svelte';
import PostsPage from './+page.svelte';

const route = vi.hoisted(() => ({
  params: { id: 'post' },
  url: new URL('https://blog.example/admin/posts/post/edit'),
}));

vi.mock('$app/state', () => ({ page: route }));

const createdAt = new Date('2026-11-26T16:30:00Z');
const publishedAt = new Date('2026-11-26T17:00:00Z');
const updatedAt = new Date('2026-11-26T18:00:00Z');
const layoutData = { signedIn: true, returnTo: 'https://blog.example/' };
const post = {
  id: 'post',
  title: '작성 중인 글',
  categoryId: 1,
  categoryName: '개발',
  tags: [],
  version: 1,
  createdAt,
  publishedAt,
  updatedAt,
  deletedAt: null,
};

it.each(['draft', 'published', 'archived'] as const)(
  'shows the public detail shortcut only for a published administrator post (%s)',
  async status => {
    render(DetailPage, {
      params: route.params,
      form: null,
      data: {
        ...layoutData,
        post: {
          ...post,
          status,
          publishedAt: status === 'draft' ? null : publishedAt,
          html: '<p>본문</p>',
        },
      },
    });
    const link = page.getByRole('link', { name: '공개 글 보기' });
    if (status === 'published') {
      await expect.element(link).toHaveAttribute('href', '/posts/post');
    } else {
      await expect.element(link).not.toBeInTheDocument();
    }
  },
);

it.each([true, false])(
  'uses the existing administrator session to show the protected shortcut (%s)',
  async signedIn => {
    render(PublicDetailPage, {
      params: route.params,
      form: null,
      data: {
        ...layoutData,
        signedIn,
        post: {
          id: post.id,
          title: post.title,
          categoryName: post.categoryName,
          categoryId: post.categoryId,
          tags: post.tags,
          publishedAt,
          html: '<p>본문</p>',
        },
      },
    });
    const link = page.getByRole('link', { name: '관리자 상세 보기' });
    if (signedIn) {
      await expect.element(link).toHaveAttribute('href', '/admin/posts/post');
      await expect.element(link).toHaveAttribute('data-sveltekit-reload');
      await expect
        .element(link)
        .toHaveAttribute('data-sveltekit-preload-data', 'false');
    } else {
      await expect.element(link).not.toBeInTheDocument();
    }
  },
);

it('shows timestamps by post status and links directly to edit', async () => {
  render(PostsPage, {
    params: {},
    form: null,
    data: {
      ...layoutData,
      posts: [
        { ...post, status: 'draft', publishedAt: null, updatedAt: createdAt },
        { ...post, id: 'published', status: 'published' },
        { ...post, id: 'archived', status: 'archived' },
      ],
    },
  });
  const items = page.getByRole('listitem');
  expect(
    [...items.elements()].map(item => item.querySelectorAll('time').length),
  ).toEqual([2, 2, 1]);
  await expect.element(items.nth(0)).toHaveTextContent('생성 시각');
  await expect.element(items.nth(1)).toHaveTextContent('최초 발행 시각');
  await expect.element(items.nth(2)).toHaveTextContent('최종 변경 시각');
  await expect
    .element(items.nth(0).getByRole('link', { name: '작성 중인 글 수정' }))
    .toHaveAttribute('href', '/admin/posts/post/edit');
});

it('shows all recorded detail timestamps and keeps the retained status visible in trash', async () => {
  const detail = render(DetailPage, {
    params: route.params,
    form: null,
    data: {
      ...layoutData,
      post: { ...post, status: 'archived', html: '<p>본문</p>' },
    },
  });
  expect(
    [...document.querySelectorAll('time')].map(time => time.dateTime),
  ).toEqual(
    [createdAt, publishedAt, updatedAt].map(time => time.toISOString()),
  );
  await expect
    .element(page.getByRole('link', { name: '수정' }))
    .toHaveAttribute('href', '/admin/posts/post/edit?from=detail');
  detail.unmount();

  render(TrashPage, {
    params: {},
    form: null,
    data: {
      ...layoutData,
      posts: [{ ...post, status: 'archived', deletedAt: updatedAt }],
    },
  });
  await expect.element(page.getByRole('listitem')).toHaveTextContent('보관됨');
});

it.each([
  [
    '?from=detail',
    '/admin/posts/post',
    '?/save&from=detail',
    '게시글 상세로 돌아가기',
  ],
  ['', '/admin/posts', '?/save', '게시글 목록으로 돌아가기'],
  [
    '?from=https://external.example',
    '/admin/posts',
    '?/save',
    '게시글 목록으로 돌아가기',
  ],
])(
  'uses one internal destination for both editor exit links (%s)',
  async (search, target, action, label) => {
    route.url.search = search;
    render(EditPage, {
      params: route.params,
      form: null,
      data: {
        ...layoutData,
        post: { ...post, status: 'published', body: '본문' },
        categories: [{ id: 1, name: '개발' }],
      },
    });
    await expect
      .element(page.getByRole('link', { name: '취소' }))
      .toHaveAttribute('href', target);
    await expect
      .element(page.getByRole('link', { name: label }))
      .toHaveAttribute('href', target);
    const save = page
      .getByRole('button', { name: '저장' })
      .element() as HTMLButtonElement;
    expect(save.form?.getAttribute('action')).toBe(action);
  },
);
