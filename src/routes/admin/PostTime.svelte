<script lang="ts" module>
  const format = new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  });
</script>

<script lang="ts">
  let { value }: { value: Date } = $props();
</script>

<time datetime={value.toISOString()}>{format.format(value)}</time>
