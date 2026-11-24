<script lang="ts">
  import '@milkdown/crepe/theme/common/style.css';
  import '@milkdown/crepe/theme/frame.css';

  import { onMount, tick } from 'svelte';

  let { value, invalid = false }: { value: string; invalid?: boolean } =
    $props();
  let textarea: HTMLTextAreaElement;
  let label: HTMLLabelElement;
  let root: HTMLDivElement;
  let ready = $state(false);

  onMount(() => {
    const form = textarea.form;
    if (!form) return;
    let disposed = false;

    async function initialize(form: HTMLFormElement) {
      const [
        { Crepe },
        { editorViewCtx, editorViewOptionsCtx },
        { uploadConfig },
      ] = await Promise.all([
        import('@milkdown/crepe'),
        import('@milkdown/kit/core'),
        import('@milkdown/kit/plugin/upload'),
      ]);
      if (disposed) return;

      const source = textarea.value;
      const editor = new Crepe({
        root,
        defaultValue: source,
        features: {
          [Crepe.Feature.ImageBlock]: false,
          [Crepe.Feature.Latex]: false,
        },
        featureConfigs: {
          [Crepe.Feature.Placeholder]: { text: '본문을 입력해 주세요.' },
        },
      });
      editor.editor.config(ctx => {
        ctx.update(uploadConfig.key, options => ({
          ...options,
          uploader: async () => [],
        }));
        ctx.update(editorViewOptionsCtx, options => ({
          ...options,
          attributes: {
            role: 'textbox',
            'aria-multiline': 'true',
            'aria-labelledby': 'body-label',
            ...(invalid
              ? { 'aria-invalid': 'true', 'aria-describedby': 'post-errors' }
              : {}),
          },
        }));
      });

      let canonical: string;
      try {
        await editor.create();
        canonical = editor.getMarkdown();
      } catch {
        await editor.destroy();
        return;
      }

      if (disposed || textarea.value !== source) {
        await editor.destroy();
        return;
      }

      function serialize(event: FormDataEvent) {
        if (disposed) return;
        const markdown = editor.getMarkdown();
        event.formData.set('body', markdown === canonical ? source : markdown);
      }

      const moveFocus = document.activeElement === textarea;
      const fieldLabel = label;
      const editable = editor.editor.action(ctx => ctx.get(editorViewCtx).dom);
      function focusEditor(event: MouseEvent) {
        event.preventDefault();
        editable.focus();
      }
      fieldLabel.addEventListener('click', focusEditor);
      form.addEventListener('formdata', serialize);
      ready = true;
      if (moveFocus) {
        void tick().then(() => {
          if (!disposed) editable.focus();
        });
      }
      return async () => {
        fieldLabel.removeEventListener('click', focusEditor);
        form.removeEventListener('formdata', serialize);
        await editor.destroy();
      };
    }

    const cleanup = initialize(form).catch(() => undefined);
    return () => {
      disposed = true;
      void cleanup.then(dispose => dispose?.()).catch(() => undefined);
    };
  });
</script>

<div class="body-field">
  <label id="body-label" for="body" bind:this={label}>본문 (Markdown)</label>
  <textarea
    id="body"
    name="body"
    rows="10"
    bind:this={textarea}
    {value}
    hidden={ready}
    aria-invalid={invalid || undefined}
    aria-describedby={invalid ? 'post-errors' : undefined}></textarea>
  <div bind:this={root} hidden={!ready}></div>
</div>

<style>
  .body-field {
    margin-block: 1rem;
  }

  label,
  textarea:not([hidden]) {
    display: block;
  }

  textarea {
    box-sizing: border-box;
    inline-size: 100%;
  }
</style>
