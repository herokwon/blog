import type { DeploymentPR } from './policy.ts';

type Repository = { owner: string; repo: string };
type Page = { per_page: number };
type Sha = { sha: string };
type Milestone = { number: number; title: string };
type Branch = { name: string; commit: Sha };
type Issue = {
  number: number;
  state: string;
  body?: string | null;
  pull_request?: unknown;
  milestone?: Milestone | null;
};
type Comment = {
  id: number;
  body?: string;
  user: { type: string } | null;
};
type Pull = {
  number: number;
  state: string;
  body: string | null;
  milestone?: Milestone | null;
  head: { sha: string; ref: string };
};
type EventPull = DeploymentPR & {
  number: number;
  head: DeploymentPR['head'] & Sha;
  user: { login: string };
  html_url: string;
};
type Deployment = Sha & { id: number };
type DeploymentStatus = { state: string; description?: string };
type Content =
  | { type: 'file'; encoding: string; content: string }
  | { type: 'dir' | 'symlink' | 'submodule' }
  | unknown[];
type Endpoint<Params, Data = unknown> = (
  params: Repository & Params,
) => Promise<{ data: Data }>;
type List<Params, Item> = Endpoint<Params & Page, Item[]>;

export type GitHub = {
  paginate<Params, Item>(
    endpoint: List<Params, Item>,
    params: Repository & Params & Page,
  ): Promise<Item[]>;
  rest: {
    issues: {
      listMilestones: List<{ state: 'open' }, Milestone>;
      listForRepo: List<{ state: 'all' }, Issue>;
      listComments: List<{ issue_number: number }, Comment>;
      get: Endpoint<{ issue_number: number }, Issue>;
      update: Endpoint<{ issue_number: number; milestone: number }>;
      create: Endpoint<
        { title: string; milestone: number; body: string },
        Issue
      >;
      updateComment: Endpoint<{ comment_id: number; body: string }>;
      createComment: Endpoint<{ issue_number: number; body: string }>;
    };
    pulls: {
      get: Endpoint<{ pull_number: number }, Pull>;
      list: List<
        { state: 'all'; head: string; base: string },
        { state: string }
      >;
      create: Endpoint<
        { head: string; base: string; title: string; body: string },
        { number: number }
      >;
    };
    repos: {
      getContent: Endpoint<{ path: string; ref: string }, Content>;
      listBranches: List<object, Branch>;
      listDeployments: List<{ environment?: string; sha?: string }, Deployment>;
      listDeploymentStatuses: List<{ deployment_id: number }, DeploymentStatus>;
      compareCommits: Endpoint<
        { base: string; head: string },
        { status: string }
      >;
      createDeploymentStatus: Endpoint<{
        deployment_id: number;
        state: 'in_progress';
        description: string;
        environment_url?: string;
      }>;
      getReleaseByTag: Endpoint<{ tag: string }>;
      createRelease: Endpoint<{
        tag_name: string;
        target_commitish: string;
        name: string;
        generate_release_notes: boolean;
      }>;
    };
    git: {
      getRef: Endpoint<{ ref: string }, { object: Sha & { type: string } }>;
      createRef: Endpoint<Sha & { ref: string }>;
      createBlob: Endpoint<{ content: string; encoding: 'utf-8' }, Sha>;
      getCommit: Endpoint<{ commit_sha: string }, { tree: Sha }>;
      createTree: Endpoint<
        {
          base_tree: string;
          tree: (Sha & { path: string; mode: '100644'; type: 'blob' })[];
        },
        Sha
      >;
      createCommit: Endpoint<
        { message: string; tree: string; parents: string[] },
        Sha
      >;
    };
  };
};

export type ActionContext = {
  github: GitHub;
  context: {
    repo: Repository;
    payload: {
      pull_request?: EventPull;
      repository: { full_name: string };
    };
  };
};

export type Action = ActionContext & {
  core: {
    info(message: string): void;
    setOutput(key: string, value: string): void;
    summary: { addRaw(text: string): { write(): Promise<unknown> } };
  };
};
