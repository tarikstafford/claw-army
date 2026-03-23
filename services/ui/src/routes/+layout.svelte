<script lang="ts">
  import '@fontsource/cormorant-garamond/300.css';
  import '@fontsource/cormorant-garamond/300-italic.css';
  import '@fontsource/cormorant-garamond/400.css';
  import '@fontsource/cormorant-garamond/400-italic.css';
  import '@fontsource/cormorant-garamond/600.css';
  import '@fontsource-variable/dm-sans/index.css';
  import '@fontsource/press-start-2p/400.css';
  import '../app.css';

  let { children } = $props();
</script>

{@render children()}
