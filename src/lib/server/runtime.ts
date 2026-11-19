import { env as workerEnv } from 'cloudflare:workers';

import type { AccessConfig } from './access';

export const env: typeof workerEnv & AccessConfig = workerEnv;
