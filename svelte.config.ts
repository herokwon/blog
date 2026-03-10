import adapter from '@sveltejs/adapter-cloudflare';
import type { Config } from '@sveltejs/kit';

export default {
  kit: {
    adapter: adapter(),
  },
} satisfies Config;
