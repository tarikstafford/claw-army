<script lang="ts">
  import { onNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import '@fontsource/cormorant-garamond/300.css';
  import '@fontsource/cormorant-garamond/300-italic.css';
  import '@fontsource/cormorant-garamond/400.css';
  import '@fontsource/cormorant-garamond/400-italic.css';
  import '@fontsource/cormorant-garamond/600.css';
  import '@fontsource-variable/dm-sans/index.css';
  import '@fontsource/press-start-2p/400.css';
  import Aurora from '$lib/components/ui/Aurora.svelte';
  import NavShell from '$lib/components/ui/NavShell.svelte';
  import { prefersReducedMotion } from '$lib/motion';
  import { getAuroraVariant, getNavVariant, isBackOfficeRoute } from '$lib/route-mode';
  import '../app.css';

  let { children, data } = $props();

  const pathname = $derived(page.url.pathname);
  const navVariant = $derived(getNavVariant(pathname));
  const auroraVariant = $derived(getAuroraVariant(pathname));

  $effect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('back-office', isBackOfficeRoute(pathname));
  });

  onMount(() => {
    localStorage.removeItem('akasa-mode');
  });

  onNavigate((navigation) => {
    if (typeof document === 'undefined' || prefersReducedMotion()) {
      return;
    }

    const transitionDocument = document as Document & {
      startViewTransition?: (callback: () => Promise<void> | void) => void;
    };

    if (!transitionDocument.startViewTransition) return;

    return new Promise<void>((resolve) => {
      transitionDocument.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });
</script>

<Aurora variant={auroraVariant} />
<NavShell variant={navVariant} pathname={pathname} session={data.session ?? null} />

{@render children()}
