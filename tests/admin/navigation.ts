import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, type Page } from '@playwright/test';

/** Verify a real hydrated interaction, without sleeping or waiting for network idle. */
export async function waitForPostListReady(page: Page) {
  const menu = page
    .getByRole('button', { name: /작업 메뉴$/ })
    .filter({ visible: true })
    .first();
  await expect(async () => {
    // A click before hydration can be lost. Retry only while the menu is closed.
    if ((await menu.getAttribute('aria-expanded')) !== 'true')
      await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true', {
      timeout: 100,
    });
  }).toPass({ timeout: 5000 });
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
}

/** Resolve the code-only destination from build metadata, never a hard-coded node number. */
export async function newPostModuleURL(origin: string) {
  const { manifest } = await import(
    pathToFileURL(resolve('.svelte-kit/output/server/manifest.js')).href
  );
  const route = manifest.routes.find(
    (route: { id: string }) => route.id === '/admin/posts/new',
  );
  const node: { imports: string[] } = await manifest.nodes[route.page.leaf]();
  const entry = node.imports.find(path =>
    /^_app\/immutable\/nodes\/[^/]+\.js$/.test(path),
  );
  if (!entry) throw new Error('Missing built new-post module');
  return new URL('/' + entry, origin).href;
}
