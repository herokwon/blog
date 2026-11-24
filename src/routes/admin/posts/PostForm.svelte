<script lang="ts">
  import { resolve } from '$app/paths';

  import type { PostErrors } from '../../../lib/server/posts/domain';

  interface Props {
    values: {
      id: string;
      title: string;
      body: string;
      categoryId: string;
      tags: string;
      version?: string;
    };
    categories: { id: number; name: string }[] | null;
    errors?: PostErrors;
    message?: string;
    creating?: boolean;
  }

  let {
    values,
    categories,
    errors = {},
    message,
    creating = false,
  }: Props = $props();
  let errorSummary = $state<HTMLDivElement>();
  const messages = {
    title: {
      required: '제목을 입력해 주세요.',
      tooLong: '제목은 200자 이하여야 합니다.',
    },
    body: {
      required: '본문을 입력해 주세요.',
      tooLong: '본문은 256 KiB 이하여야 합니다.',
    },
    categoryId: { required: '카테고리를 선택해 주세요.' },
    tags: {
      invalid: '태그에는 한글, 영문, 숫자만 사용할 수 있습니다.',
      duplicate: '중복된 태그를 제거해 주세요.',
    },
  } satisfies Record<
    keyof PostErrors,
    Partial<Record<NonNullable<PostErrors[keyof PostErrors]>, string>>
  >;

  function fieldError(field: keyof PostErrors) {
    const code = errors[field];
    const options: Partial<
      Record<NonNullable<PostErrors[keyof PostErrors]>, string>
    > = messages[field];
    return code ? options[code] : undefined;
  }

  $effect(() => {
    if (message || Object.keys(errors).length) errorSummary?.focus();
  });
</script>

<form method="POST" action={creating ? '?/saveDraft' : '?/save'}>
  {#if message || Object.keys(errors).length}
    <div id="post-errors" role="alert" tabindex="-1" bind:this={errorSummary}>
      {#if message}<p>{message}</p>{/if}
      {#each Object.keys(messages) as field (field)}
        {#if fieldError(field as keyof PostErrors)}
          <p>{fieldError(field as keyof PostErrors)}</p>
        {/if}
      {/each}
    </div>
  {/if}
  {#if creating}
    <input type="hidden" name="id" value={values.id} />
  {:else}
    <input type="hidden" name="version" value={values.version} />
  {/if}
  <p>
    <label for="title">제목 (필수)</label><br />
    <input
      id="title"
      name="title"
      value={values.title}
      required
      aria-invalid={errors.title ? true : undefined}
      aria-describedby={errors.title ? 'post-errors' : undefined}
    />
  </p>
  <p>
    <label for="body">본문 (Markdown)</label><br />
    <textarea
      id="body"
      name="body"
      rows="10"
      value={values.body}
      aria-invalid={errors.body ? true : undefined}
      aria-describedby={errors.body ? 'post-errors' : undefined}></textarea>
  </p>
  <p>
    <label for="tags">태그</label><br />
    <input
      id="tags"
      name="tags"
      value={values.tags}
      aria-invalid={errors.tags ? true : undefined}
      aria-describedby={errors.tags ? 'tag-help post-errors' : 'tag-help'}
    />
    <small id="tag-help">쉼표로 구분해 입력하세요.</small>
  </p>
  {#if categories === null}
    <p>카테고리 목록을 불러오지 못했습니다. 제출한 카테고리를 유지합니다.</p>
    <input type="hidden" name="categoryId" value={values.categoryId} />
  {:else}
    <p>
      <label for="categoryId">카테고리 (필수)</label><br />
      <select
        id="categoryId"
        name="categoryId"
        value={values.categoryId}
        required
        aria-invalid={errors.categoryId ? true : undefined}
        aria-describedby={errors.categoryId ? 'post-errors' : undefined}
      >
        <option value="" disabled>카테고리를 선택하세요.</option>
        {#each categories as category (category.id)}
          <option value={String(category.id)}>{category.name}</option>
        {/each}
      </select>
    </p>
  {/if}
  {#if creating}
    <button type="submit">초안 저장</button>
    <button type="submit" formaction="?/publish">발행</button>
  {:else}
    <button type="submit">변경 저장</button>
  {/if}
  <a href={resolve('/admin/posts')}>취소</a>
</form>
