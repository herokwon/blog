<script lang="ts">
  import AdminHeading from '../AdminHeading.svelte';
  import type { PageProps } from './$types';
  import CategoryNameInput from './CategoryNameInput.svelte';

  let { data, form }: PageProps = $props();
  let errorSummary = $state<HTMLParagraphElement>();
  $effect(() => {
    if (form?.error) errorSummary?.focus();
  });
</script>

<svelte:head>
  <title>카테고리 관리</title>
</svelte:head>

<main lang="ko">
  <AdminHeading title="카테고리 관리" />
  {#if form?.error}
    <p id="category-error" role="alert" tabindex="-1" bind:this={errorSummary}>
      {form.error}
    </p>
  {/if}
  <details class="add" open={!!form?.error && form.id === undefined}>
    <summary>추가</summary>
    <form method="POST" action="?/create" aria-label="카테고리 추가">
      <CategoryNameInput
        id="name"
        value={form?.id === undefined ? form?.name : ''}
        invalid={!!form?.error && form.id === undefined}
      />
      <button type="submit">카테고리 추가</button>
    </form>
  </details>
  {#if data.categories === null}
    <p>카테고리 목록을 불러오지 못했습니다.</p>
  {:else}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (The scrollable table needs a keyboard focus target.) -->
    <div
      class="table-wrap"
      role="region"
      aria-label="카테고리 목록"
      tabindex="0"
    >
      <table aria-label="카테고리 목록">
        <thead>
          <tr>
            <th scope="col">카테고리 이름</th>
            <th scope="col">게시글 수</th>
            <th scope="col">관리</th>
          </tr>
        </thead>
        <tbody>
          {#each data.categories as category (category.id)}
            {@const renaming =
              form?.id === String(category.id) && form?.name !== undefined}
            <tr>
              <th scope="row">{category.name}</th>
              <td>{category.postCount}</td>
              <td>
                <details open={renaming}>
                  <summary>이름 변경</summary>
                  <form
                    method="POST"
                    action="?/rename"
                    aria-label={`${category.name} 이름 변경`}
                  >
                    <input type="hidden" name="id" value={category.id} />
                    <CategoryNameInput
                      id={`name-${category.id}`}
                      value={renaming ? form?.name : category.name}
                      invalid={renaming}
                    />
                    <button type="submit">이름 저장</button>
                  </form>
                </details>
                {#if category.referenceCount === 0}
                  <details>
                    <summary>삭제</summary>
                    <form
                      method="POST"
                      action="?/remove"
                      aria-label={`${category.name} 삭제`}
                    >
                      <input type="hidden" name="id" value={category.id} />
                      <button type="submit">카테고리 삭제 확인</button>
                    </form>
                  </details>
                {:else if category.postCount === 0}
                  <small>휴지통의 게시글에서 사용 중</small>
                {/if}
              </td>
            </tr>
          {:else}
            <tr><td colspan="3">카테고리를 추가해 주세요.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</main>

<style>
  .add {
    margin-block-end: 0.75rem;
  }

  .table-wrap {
    overflow-x: auto;
  }

  table {
    border-collapse: collapse;
    inline-size: 100%;
  }

  th,
  td {
    border-block-end: 1px solid #ccc;
    padding: 0.5rem;
    text-align: start;
    vertical-align: top;
  }

  th {
    overflow-wrap: anywhere;
  }

  thead th {
    white-space: nowrap;
  }
</style>
