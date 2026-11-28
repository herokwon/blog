<script module lang="ts">
  const format = new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeZone: 'Asia/Seoul',
  });
</script>

<script lang="ts">
  let { value }: { value: Date } = $props();
</script>

<time datetime={value.toISOString()}>{format.format(value)}</time>
