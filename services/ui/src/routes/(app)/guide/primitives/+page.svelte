<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import PageShell from '$lib/components/ui/PageShell.svelte';
  import SectionHeading from '$lib/components/ui/SectionHeading.svelte';

  let demoValue = $state('Akasa workforce');
</script>

<svelte:head>
  <title>Primitives | Akasa</title>
</svelte:head>

<PageShell width="960px" class="primitives-page">
  <SectionHeading eyebrow="Guide" title="UI primitives" emphasis="Continuous theatre shelf" />

  <div class="grid">
    <Card>
      <h3>Buttons</h3>
      <div class="row">
        <Button>Primary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="nav">Nav</Button>
      </div>
    </Card>

    <Card>
      <h3>Inputs</h3>
      <Input id="demo-input" label="Mission name" bind:value={demoValue} />
      <Input id="error-input" label="Budget cap" value="$0" error="Budget must be greater than zero." />
    </Card>
  </div>
</PageShell>

<style>
  .primitives-page {
    padding: 132px 0 64px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 20px;
  }

  h3 {
    font-family: var(--font-display);
    font-size: 24px;
    margin-bottom: 16px;
    color: var(--text);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
</style>
