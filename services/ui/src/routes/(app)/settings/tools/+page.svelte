<script lang="ts">
  import { onMount } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import ToolBelt from '$lib/components/tools/ToolBelt.svelte';
  import ToolCatalog from '$lib/components/tools/ToolCatalog.svelte';
  import SlidePanel from '$lib/components/SlidePanel.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import WebhookRuleForm from '$lib/components/tools/WebhookRuleForm.svelte';
  import WebhookLogEntry from '$lib/components/tools/WebhookLogEntry.svelte';
  import { TOOL_CATALOG, TOOL_EVENT_TYPES, SAMPLE_PAYLOADS } from '$lib/tool-catalog';

  let { data } = $props();

  // ── Section visibility ───────────────────────────────────────────
  let activeSection = $state<'connected' | 'catalog' | 'webhooks' | 'import'>('connected');

  // ── Connected tools state ────────────────────────────────────────
  let disconnectTarget = $state<{ connectionId: string; toolName: string } | null>(null);
  let successBanner = $state<string | null>(null);
  let errorBanner = $state<string | null>(null);

  onMount(() => {
    if (data.connected) {
      successBanner = `Connected to ${data.connected}`;
      setTimeout(() => { successBanner = null; }, 4000);
    }
    if (data.oauthError) {
      errorBanner = 'Connection failed. Check your account permissions and try again.';
      setTimeout(() => { errorBanner = null; }, 4000);
    }
  });

  function startOAuth(toolId: string) {
    window.location.href =
      '/api/akasa/tool-connections/oauth/' + toolId +
      '/start?userId=' + encodeURIComponent(data.userId) +
      '&redirectUri=' + encodeURIComponent(window.location.origin + '/api/akasa/tool-connections/oauth/' + toolId + '/callback');
  }

  async function handleDisconnect() {
    if (!disconnectTarget) return;
    try {
      const res = await fetch(`/api/akasa/tool-connections/${disconnectTarget.connectionId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        disconnectTarget = null;
        await invalidateAll();
      } else {
        errorBanner = 'Failed to disconnect. Please try again.';
        setTimeout(() => { errorBanner = null; }, 4000);
        disconnectTarget = null;
      }
    } catch {
      errorBanner = 'Failed to disconnect. Please try again.';
      setTimeout(() => { errorBanner = null; }, 4000);
      disconnectTarget = null;
    }
  }

  // ── Webhook state ────────────────────────────────────────────────
  let showRuleForm = $state(false);
  let deleteTarget = $state<{ id: string; eventType: string } | null>(null);
  let formError = $state<string | null>(null);

  interface WebhookUrlEntry {
    connectionId: string;
    url: string;
    loading: boolean;
    copied: boolean;
  }
  let webhookUrls = $state<WebhookUrlEntry[]>([]);
  let fetchingUrls = $state(false);

  let retryTarget = $state<{ id: string; toolId: string; eventType: string; payload: Record<string, unknown> } | null>(null);
  let retrying = $state(false);
  let retryResult = $state<{ success: boolean; message: string } | null>(null);

  let showSimulator = $state(false);
  let selectedToolId = $state('');
  let selectedEventType = $state('');
  let simulationResult = $state<{
    matched: boolean;
    eventType: string;
    toolId: string;
    matchedRule: { id: string; eventType: string; assignToAgentId: string | null; condition: string | null } | null;
    agentId: string | null;
    agentName: string | null;
  } | null>(null);
  let simulationError = $state<string | null>(null);
  let isSimulating = $state(false);

  function getToolName(toolId: string): string {
    return TOOL_CATALOG.find((t) => t.id === toolId)?.name ?? toolId;
  }

  function getAgentName(agentId: string | null | undefined): string {
    if (!agentId) return '--';
    return (data.agents as Array<{ id: string; name: string }>).find((a) => a.id === agentId)?.name ?? agentId;
  }

  function getEventTypesForTool(toolId: string): readonly string[] {
    return TOOL_EVENT_TYPES[toolId] ?? [];
  }

  function getSamplePayload(toolId: string, eventType: string): Record<string, unknown> {
    return (SAMPLE_PAYLOADS[toolId]?.[eventType] ?? { eventType }) as Record<string, unknown>;
  }

  async function fetchWebhookUrls() {
    const webhookConnections = data.connections.filter((c: { status: string }) => c.status !== 'disconnected');
    if (webhookConnections.length === 0) return;
    fetchingUrls = true;
    const results: WebhookUrlEntry[] = [];
    await Promise.allSettled(
      webhookConnections.map(async (conn: { id: string }) => {
        try {
          const res = await fetch('/api/akasa/webhooks/generate-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connectionId: conn.id }),
          });
          if (res.ok) {
            const urlData = await res.json();
            results.push({ connectionId: conn.id, url: urlData.webhookUrl, loading: false, copied: false });
          }
        } catch {
          results.push({ connectionId: conn.id, url: '', loading: false, copied: false });
        }
      })
    );
    webhookUrls = results;
    fetchingUrls = false;
  }

  async function copyWebhookUrl(connectionId: string) {
    const entry = webhookUrls.find((u) => u.connectionId === connectionId);
    if (!entry || !entry.url) return;
    try {
      await navigator.clipboard.writeText(entry.url);
      entry.copied = true;
      setTimeout(() => {
        const e = webhookUrls.find((u) => u.connectionId === connectionId);
        if (e) e.copied = false;
      }, 2000);
    } catch {
      // Fallback
    }
  }

  function getWebhookUrl(connectionId: string): string {
    return webhookUrls.find((u) => u.connectionId === connectionId)?.url ?? '';
  }

  function openRetry(log: { id: string; toolId: string; action: string; requestSummary: string | null }) {
    const eventType = log.action.startsWith('webhook:') ? log.action.slice('webhook:'.length) : log.action;
    let payload: Record<string, unknown> = {};
    if (log.requestSummary) {
      try { payload = JSON.parse(log.requestSummary); } catch { payload = { eventType }; }
    }
    retryTarget = { id: log.id, toolId: log.toolId, eventType, payload };
    retryResult = null;
  }

  function closeRetry() { retryTarget = null; retryResult = null; }

  async function handleRetry() {
    if (!retryTarget) return;
    retrying = true;
    retryResult = null;
    try {
      const res = await fetch(`/api/akasa/webhooks/${retryTarget.toolId}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: data.userId,
          eventType: retryTarget.eventType,
          payload: retryTarget.payload,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        retryResult = {
          success: result.matched,
          message: result.matched
            ? `Delivered to agent ${result.agentName ?? result.agentId ?? '--'}`
            : 'No routing rule matched',
        };
      } else {
        retryResult = { success: false, message: result.error ?? 'Retry failed' };
      }
    } catch {
      retryResult = { success: false, message: 'Network error' };
    } finally {
      retrying = false;
    }
  }

  function openSimulator() {
    simulationResult = null;
    simulationError = null;
    selectedToolId = '';
    selectedEventType = '';
    showSimulator = true;
  }

  function closeSimulator() {
    showSimulator = false;
    simulationResult = null;
    simulationError = null;
  }

  async function runSimulation() {
    if (!selectedToolId || !selectedEventType) { simulationError = 'Please select a tool and event type'; return; }
    isSimulating = true;
    simulationError = null;
    simulationResult = null;
    try {
      const payload = getSamplePayload(selectedToolId, selectedEventType);
      const res = await fetch(`/api/akasa/webhooks/${selectedToolId}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.userId, eventType: selectedEventType, payload }),
      });
      if (!res.ok) {
        const err = await res.json();
        simulationError = err.error ?? 'Simulation failed';
        return;
      }
      const result = await res.json();
      if (result.agentId) result.agentName = getAgentName(result.agentId);
      simulationResult = result;
    } catch { simulationError = 'Failed to run simulation. Please try again.'; }
    finally { isSimulating = false; }
  }

  async function handleCreateRule(rule: {
    connectionId: string; toolId: string; eventType: string; condition: string; assignToAgentId: string;
  }) {
    formError = null;
    try {
      const res = await fetch('/api/akasa/webhook-routing-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: data.userId,
          connectionId: rule.connectionId,
          toolId: rule.toolId,
          eventType: rule.eventType,
          condition: rule.condition || null,
          assignToAgentId: rule.assignToAgentId,
        }),
      });
      if (res.status === 201 || res.ok) { showRuleForm = false; await invalidateAll(); }
      else { formError = 'Failed to create rule. Please try again.'; }
    } catch { formError = 'Failed to create rule. Please try again.'; }
  }

  async function handleDeleteRule() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/akasa/webhook-routing-rules/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.status === 204 || res.ok) { deleteTarget = null; await invalidateAll(); }
      else { formError = 'Failed to delete rule.'; deleteTarget = null; }
    } catch { formError = 'Failed to delete rule.'; deleteTarget = null; }
  }

  // ── OpenAPI Import state ─────────────────────────────────────────
  let specUrl = $state('');
  let importLoading = $state(false);
  let importErrorMsg = $state<string | null>(null);
  let importSuccessMsg = $state<string | null>(null);

  interface PreviewEndpoint {
    operationId: string | null;
    method: string;
    path: string;
    summary: string | null;
    description: string | null;
    tags: string[];
    selected: boolean;
  }

  let previewTitle = $state('');
  let previewVersion = $state('');
  let previewBaseUrl = $state('');
  let previewEndpoints = $state<PreviewEndpoint[]>([]);
  let showPreview = $state(false);
  let importing = $state(false);

  interface RegistryEntry {
    id: string; specId: string; specTitle: string; specVersion: string | null;
    specUrl: string | null; baseUrl: string; operationId: string | null;
    method: string; path: string; summary: string | null; description: string | null;
    tags: string[] | null; isEnabled: boolean; createdAt: string;
  }

  interface SpecGroup {
    specId: string; specTitle: string; specVersion: string | null;
    specUrl: string | null; baseUrl: string; endpoints: RegistryEntry[]; expanded: boolean;
  }

  let specGroups = $derived.by(() => {
    const entries = data.registry as RegistryEntry[];
    const groupMap = new Map<string, SpecGroup>();
    for (const entry of entries) {
      if (!groupMap.has(entry.specId)) {
        groupMap.set(entry.specId, {
          specId: entry.specId, specTitle: entry.specTitle, specVersion: entry.specVersion,
          specUrl: entry.specUrl, baseUrl: entry.baseUrl, endpoints: [], expanded: false,
        });
      }
      groupMap.get(entry.specId)!.endpoints.push(entry);
    }
    return Array.from(groupMap.values());
  });

  const allSelected = $derived(previewEndpoints.length > 0 && previewEndpoints.every(e => e.selected));
  const noneSelected = $derived(previewEndpoints.every(e => !e.selected));
  const selectedCount = $derived(previewEndpoints.filter(e => e.selected).length);

  async function handlePreview() {
    if (!specUrl.trim()) return;
    importLoading = true;
    importErrorMsg = null;
    showPreview = false;
    try {
      const res = await fetch('/api/akasa/tool-registry/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specUrl: specUrl.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }));
        importErrorMsg = body.error ?? `Failed to parse spec (${res.status})`;
        return;
      }
      const parsed = await res.json();
      previewTitle = parsed.title;
      previewVersion = parsed.version ?? '';
      previewBaseUrl = parsed.baseUrl;
      previewEndpoints = parsed.endpoints.map((ep: PreviewEndpoint) => ({ ...ep, selected: true }));
      showPreview = true;
    } catch (err) {
      importErrorMsg = `Network error: ${(err as Error).message}`;
    } finally { importLoading = false; }
  }

  function toggleAll() {
    const newVal = !allSelected;
    previewEndpoints = previewEndpoints.map(e => ({ ...e, selected: newVal }));
  }

  function toggleEndpoint(index: number) {
    previewEndpoints = previewEndpoints.map((e, i) => i === index ? { ...e, selected: !e.selected } : e);
  }

  async function handleImport() {
    if (noneSelected) return;
    importing = true;
    importErrorMsg = null;
    const selectedEndpoints = previewEndpoints.filter(e => e.selected).map(e => ({ method: e.method, path: e.path }));
    try {
      const res = await fetch('/api/akasa/tool-registry/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.userId, specUrl: specUrl.trim(), selectedEndpoints }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }));
        importErrorMsg = body.error ?? `Import failed (${res.status})`;
        return;
      }
      const imported = await res.json();
      importSuccessMsg = `Imported ${imported.length} endpoint${imported.length === 1 ? '' : 's'} from ${previewTitle}`;
      showPreview = false;
      specUrl = '';
      previewEndpoints = [];
      await invalidateAll();
      setTimeout(() => { importSuccessMsg = null; }, 6000);
    } catch (err) {
      importErrorMsg = `Network error: ${(err as Error).message}`;
    } finally { importing = false; }
  }

  async function handleDeleteSpec(specId: string) {
    try {
      const res = await fetch(`/api/akasa/tool-registry/${specId}?userId=${encodeURIComponent(data.userId)}`, { method: 'DELETE' });
      if (res.ok) await invalidateAll();
      else { importErrorMsg = 'Failed to remove imported spec'; setTimeout(() => { importErrorMsg = null; }, 4000); }
    } catch { importErrorMsg = 'Failed to remove imported spec'; setTimeout(() => { importErrorMsg = null; }, 4000); }
  }

  async function handleToggleEndpoint(entryId: string, currentEnabled: boolean) {
    try {
      await fetch(`/api/akasa/tool-registry/${entryId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.userId, isEnabled: !currentEnabled }),
      });
      await invalidateAll();
    } catch { importErrorMsg = 'Failed to toggle endpoint'; setTimeout(() => { importErrorMsg = null; }, 4000); }
  }

  function toggleGroup(specId: string) {
    const group = specGroups.find(g => g.specId === specId);
    if (group) group.expanded = !group.expanded;
  }

  function methodColor(method: string): string {
    switch (method.toLowerCase()) {
      case 'get': return 'var(--accent-teal, #2DD4BF)';
      case 'post': return 'var(--fo-gold, #FBBF24)';
      case 'put': return 'var(--fo-plum-m, #A78BFA)';
      case 'patch': return 'var(--rose, #F472B6)';
      case 'delete': return 'var(--error, #f87171)';
      default: return 'var(--text-muted)';
    }
  }
</script>

<div class="tools-settings">
  <h2 class="page-heading">Tools</h2>
  <p class="page-desc">Manage connected integrations, webhooks, and imported APIs.</p>

  {#if successBanner}
    <div class="banner banner-success">{successBanner}</div>
  {/if}
  {#if errorBanner}
    <div class="banner banner-error">{errorBanner}</div>
  {/if}

  <!-- Section tabs -->
  <nav class="section-tabs">
    <button class="section-tab" class:active={activeSection === 'connected'} onclick={() => activeSection = 'connected'}>Connected</button>
    <button class="section-tab" class:active={activeSection === 'catalog'} onclick={() => activeSection = 'catalog'}>Catalog</button>
    <button class="section-tab" class:active={activeSection === 'webhooks'} onclick={() => activeSection = 'webhooks'}>Webhooks</button>
    <button class="section-tab" class:active={activeSection === 'import'} onclick={() => activeSection = 'import'}>OpenAPI Import</button>
  </nav>

  <!-- Connected tools section -->
  {#if activeSection === 'connected'}
    <section class="tool-section">
      <ToolBelt
        connections={data.connections}
        onstartOAuth={startOAuth}
        ondisconnect={(connId, name) => { disconnectTarget = { connectionId: connId, toolName: name }; }}
        analytics={data.analytics ?? {}}
      />
    </section>
  {/if}

  <!-- Catalog section -->
  {#if activeSection === 'catalog'}
    <section class="tool-section">
      <ToolCatalog
        connections={data.connections}
        onconnect={startOAuth}
        ondisconnect={(connId, name) => { disconnectTarget = { connectionId: connId, toolName: name }; }}
      />
    </section>
  {/if}

  <!-- Webhooks section -->
  {#if activeSection === 'webhooks'}
    <section class="tool-section">
      <!-- Webhook URLs -->
      {#if data.connections.filter((c: { status: string }) => c.status !== 'disconnected').length > 0}
        <div class="webhook-urls-section">
          <div class="section-header">
            <h3 class="sub-heading">Webhook URLs</h3>
            <button class="btn-outline" onclick={() => fetchWebhookUrls()} disabled={fetchingUrls}>
              {fetchingUrls ? 'Loading...' : 'Refresh URLs'}
            </button>
          </div>
          <div class="webhook-urls-list">
            {#each data.connections.filter((c: { status: string }) => c.status !== 'disconnected') as conn (conn.id)}
              {@const webhookUrl = getWebhookUrl(conn.id)}
              {@const urlEntry = webhookUrls.find((u) => u.connectionId === conn.id)}
              <div class="webhook-url-row">
                <div class="webhook-url-info">
                  <span class="webhook-url-tool">{getToolName(conn.toolId)}</span>
                  {#if webhookUrl}
                    <code class="webhook-url-code">{webhookUrl}</code>
                  {:else}
                    <span class="webhook-url-placeholder">Click Refresh to generate URL</span>
                  {/if}
                </div>
                {#if webhookUrl}
                  <button class="btn-small" class:copied={urlEntry?.copied} onclick={() => copyWebhookUrl(conn.id)}>
                    {urlEntry?.copied ? 'Copied!' : 'Copy'}
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Routing Rules -->
      <div class="rules-section">
        <div class="section-header">
          <h3 class="sub-heading">Routing Rules</h3>
          <div class="section-actions">
            <button class="btn-outline btn-teal" onclick={() => openSimulator()}>Send Test Event</button>
            <button class="btn-outline btn-rose" onclick={() => { showRuleForm = true; }}>Add Rule</button>
          </div>
        </div>

        {#if formError}
          <p class="inline-error">{formError}</p>
        {/if}

        {#if data.rules.length === 0}
          <div class="empty-state">
            <p class="empty-heading">No routing rules</p>
            <p class="empty-body">Add a rule to automatically assign incoming webhooks to an agent.</p>
          </div>
        {:else}
          <div class="rules-list">
            {#each data.rules as rule (rule.id)}
              <div class="rule-row">
                <div class="rule-info">
                  <span class="rule-description">
                    When <strong>{rule.eventType}</strong> on <strong>{getToolName(rule.toolId)}</strong>
                  </span>
                  {#if rule.condition}
                    <span class="rule-condition">{rule.condition}</span>
                  {/if}
                </div>
                <span class="rule-agent">assign to <strong>{getAgentName(rule.assignToAgentId)}</strong></span>
                <button class="btn-text-danger" onclick={() => { deleteTarget = { id: rule.id, eventType: rule.eventType }; }}>Delete</button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Event Log -->
      <div class="logs-section">
        <h3 class="sub-heading">Event Log</h3>
        {#if data.logs.length === 0}
          <div class="empty-state">
            <p class="empty-heading">No webhook events yet</p>
            <p class="empty-body">Incoming webhooks will appear here once a tool sends its first event.</p>
          </div>
        {:else}
          <div class="logs-list">
            {#each data.logs as log (log.id)}
              <WebhookLogEntry {log} onretry={(l) => openRetry(l)} />
            {/each}
          </div>
        {/if}
      </div>
    </section>
  {/if}

  <!-- OpenAPI Import section -->
  {#if activeSection === 'import'}
    <section class="tool-section">
      {#if importSuccessMsg}
        <div class="banner banner-success">{importSuccessMsg}</div>
      {/if}
      {#if importErrorMsg}
        <div class="banner banner-error">{importErrorMsg}</div>
      {/if}

      <h3 class="sub-heading">Import OpenAPI Spec</h3>
      <p class="section-desc">Paste a URL to an OpenAPI or Swagger specification to auto-discover and register tool endpoints.</p>

      <div class="import-form">
        <input
          type="url"
          class="text-input"
          placeholder="https://api.example.com/openapi.json"
          bind:value={specUrl}
          onkeydown={(e) => { if (e.key === 'Enter') handlePreview(); }}
          disabled={importLoading}
        />
        <button class="btn-primary" onclick={handlePreview} disabled={importLoading || !specUrl.trim()}>
          {importLoading ? 'Parsing...' : 'Preview'}
        </button>
      </div>

      {#if showPreview}
        <div class="preview-panel">
          <div class="preview-header">
            <div class="preview-meta">
              <h4 class="preview-title">{previewTitle}</h4>
              {#if previewVersion}<span class="preview-version">v{previewVersion}</span>{/if}
              <span class="preview-base">{previewBaseUrl}</span>
            </div>
            <div class="preview-actions">
              <button class="btn-small" onclick={toggleAll}>{allSelected ? 'Deselect All' : 'Select All'}</button>
              <button class="btn-primary" onclick={handleImport} disabled={importing || noneSelected}>
                {importing ? 'Importing...' : `Import ${selectedCount} endpoint${selectedCount === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
          <div class="endpoint-list">
            {#each previewEndpoints as ep, i}
              <button class="endpoint-row" class:deselected={!ep.selected} onclick={() => toggleEndpoint(i)}>
                <span class="endpoint-check">{ep.selected ? '\u2611' : '\u2610'}</span>
                <span class="endpoint-method" style="color: {methodColor(ep.method)}">{ep.method.toUpperCase()}</span>
                <span class="endpoint-path">{ep.path}</span>
                {#if ep.summary}<span class="endpoint-summary">{ep.summary}</span>{/if}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#if specGroups.length > 0}
        <div class="registry-section">
          <h3 class="sub-heading">Imported Tools</h3>
          {#each specGroups as group}
            <div class="spec-group">
              <div class="spec-group-header" role="button" tabindex="0" onclick={() => toggleGroup(group.specId)} onkeydown={(e) => { if (e.key === 'Enter') toggleGroup(group.specId); }}>
                <div class="spec-group-meta">
                  <span class="spec-group-title">{group.specTitle}</span>
                  {#if group.specVersion}<span class="spec-group-version">v{group.specVersion}</span>{/if}
                  <span class="spec-group-count">{group.endpoints.length} endpoint{group.endpoints.length === 1 ? '' : 's'}</span>
                </div>
                <div class="spec-group-actions">
                  <button class="btn-text-danger" onclick={(e) => { e.stopPropagation(); handleDeleteSpec(group.specId); }}>Remove</button>
                  <span class="expand-icon">{group.expanded ? '\u25BC' : '\u25B6'}</span>
                </div>
              </div>
              {#if group.expanded}
                <div class="spec-group-body">
                  {#each group.endpoints as entry}
                    <div class="registry-row" class:disabled-row={!entry.isEnabled}>
                      <span class="endpoint-method" style="color: {methodColor(entry.method)}">{entry.method.toUpperCase()}</span>
                      <span class="endpoint-path">{entry.path}</span>
                      {#if entry.summary}<span class="endpoint-summary">{entry.summary}</span>{/if}
                      <button class="btn-small" onclick={() => handleToggleEndpoint(entry.id, entry.isEnabled)}>
                        {entry.isEnabled ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</div>

<!-- Disconnect modal -->
{#if disconnectTarget}
  <Modal open={true} title="Disconnect {disconnectTarget.toolName}?" onclose={() => { disconnectTarget = null; }}>
    <p>This will remove the connection. Any agents using this tool will lose access immediately.</p>
    <button class="disconnect-confirm-btn" onclick={handleDisconnect}>Disconnect Tool</button>
  </Modal>
{/if}

<!-- Slide panel for new routing rule -->
<SlidePanel open={showRuleForm} title="New Routing Rule" onclose={() => { showRuleForm = false; }}>
  <WebhookRuleForm
    connections={data.connections.filter((c: { status: string }) => c.status !== 'disconnected')}
    agents={data.agents}
    onsubmit={handleCreateRule}
    oncancel={() => { showRuleForm = false; }}
  />
</SlidePanel>

<!-- Delete rule modal -->
{#if deleteTarget}
  <Modal open={true} title="Delete this rule?" onclose={() => { deleteTarget = null; }}>
    <p style="font-family: var(--font-body); font-size: 13px; color: var(--text-muted); margin: var(--space-md) 0;">
      This routing rule will stop processing new webhook events immediately.
    </p>
    <button class="disconnect-confirm-btn" onclick={handleDeleteRule}>Delete Rule</button>
  </Modal>
{/if}

<!-- Simulation modal -->
{#if showSimulator}
  <Modal open={true} title="Send Test Event" onclose={() => closeSimulator()}>
    <div class="simulator-form">
      <div class="form-field">
        <label for="tool-select">Tool</label>
        <select id="tool-select" class="select-input" bind:value={selectedToolId} onchange={() => { selectedEventType = ''; simulationResult = null; }}>
          <option value="">Select a tool</option>
          {#each TOOL_CATALOG as tool}<option value={tool.id}>{tool.name}</option>{/each}
        </select>
      </div>
      {#if selectedToolId}
        <div class="form-field">
          <label for="event-select">Event Type</label>
          <select id="event-select" class="select-input" bind:value={selectedEventType} onchange={() => { simulationResult = null; }}>
            <option value="">Select an event type</option>
            {#each getEventTypesForTool(selectedToolId) as eventType}<option value={eventType}>{eventType}</option>{/each}
          </select>
        </div>
      {/if}
      {#if selectedToolId && selectedEventType}
        <div class="form-field">
          <label>Sample Payload</label>
          <pre class="payload-preview">{JSON.stringify(getSamplePayload(selectedToolId, selectedEventType), null, 2)}</pre>
        </div>
        <button class="btn-primary" onclick={() => runSimulation()} disabled={isSimulating}>{isSimulating ? 'Simulating...' : 'Run Simulation'}</button>
      {/if}
      {#if simulationError}<p class="inline-error">{simulationError}</p>{/if}
      {#if simulationResult}
        <div class="simulation-result" class:matched={simulationResult.matched} class:not-matched={!simulationResult.matched}>
          {#if simulationResult.matched}
            <p class="result-title">Rule Matched</p>
            <p class="result-detail">Event <strong>{simulationResult.eventType}</strong> on <strong>{getToolName(simulationResult.toolId)}</strong> would be routed to agent <strong>{simulationResult.agentName ?? simulationResult.agentId ?? '--'}</strong>.</p>
          {:else}
            <p class="result-title">No Match</p>
            <p class="result-detail">Event <strong>{simulationResult.eventType}</strong> on <strong>{getToolName(simulationResult.toolId)}</strong> did not match any active routing rules.</p>
          {/if}
          <p class="dry-run-note">Dry-run mode -- no agent was actually notified.</p>
        </div>
      {/if}
    </div>
  </Modal>
{/if}

<!-- Retry modal -->
{#if retryTarget}
  <Modal open={true} title="Retry Webhook Delivery" onclose={() => closeRetry()}>
    <div class="simulator-form">
      <p class="section-desc">Re-send this event to test routing rules.</p>
      <div style="display:flex;align-items:center;gap:var(--space-sm);">
        <span style="font-family:var(--font-body);font-size:13px;font-weight:500;color:var(--text)">{getToolName(retryTarget.toolId)}</span>
        <span style="font-family:var(--font-label);font-size:6px;color:var(--accent);letter-spacing:0.08em">{retryTarget.eventType}</span>
      </div>
      <pre class="payload-preview">{JSON.stringify(retryTarget.payload, null, 2)}</pre>
      {#if retryResult}
        <div class="simulation-result" class:matched={retryResult.success} class:not-matched={!retryResult.success}>
          <p class="result-detail">{retryResult.message}</p>
        </div>
      {/if}
      <div style="display:flex;gap:var(--space-sm);justify-content:flex-end;">
        <button class="btn-outline" onclick={() => closeRetry()}>Cancel</button>
        <button class="btn-primary" onclick={() => handleRetry()} disabled={retrying}>{retrying ? 'Retrying...' : 'Retry Delivery'}</button>
      </div>
    </div>
  </Modal>
{/if}

<style>
  .tools-settings { width: 100%; }

  .page-heading {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 600;
    color: var(--text);
    margin: 0 0 var(--space-xs) 0;
  }

  .page-desc {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0 0 var(--space-xl) 0;
  }

  .banner {
    margin-bottom: var(--space-lg);
    padding: var(--space-md) var(--space-lg);
    border-radius: var(--radius-md);
    font-family: var(--font-body);
    font-size: 13px;
    background: var(--card);
    line-height: 1.5;
  }

  .banner-success { border: 1px solid var(--success, #2DD4BF); color: var(--success, #2DD4BF); }
  .banner-error { border: 1px solid var(--error); color: var(--error); }

  /* Section tabs */
  .section-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--border);
    margin-bottom: var(--space-xl);
  }

  .section-tab {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 400;
    color: var(--text-muted);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    padding: 10px 18px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .section-tab:hover { color: var(--text); }
  .section-tab.active { color: var(--text); border-bottom-color: var(--accent); font-weight: 500; }

  .tool-section { margin-bottom: var(--space-2xl); }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-lg);
  }

  .section-actions { display: flex; gap: var(--space-sm); }

  .sub-heading {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
    margin: 0 0 var(--space-md) 0;
  }

  .section-desc {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0 0 var(--space-lg) 0;
    line-height: 1.5;
  }

  /* Webhook URLs */
  .webhook-urls-section { margin-bottom: var(--space-2xl); }
  .webhook-urls-list { display: flex; flex-direction: column; gap: var(--space-sm); }

  .webhook-url-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-md) var(--space-lg);
    gap: var(--space-md);
  }

  .webhook-url-info { display: flex; flex-direction: column; gap: var(--space-xs); min-width: 0; }
  .webhook-url-tool { font-family: var(--font-body); font-size: 13px; font-weight: 500; color: var(--text); }
  .webhook-url-code {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
    background: var(--bg);
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    word-break: break-all;
  }
  .webhook-url-placeholder { font-family: var(--font-body); font-size: 11px; color: var(--text-muted); }

  /* Rules and logs */
  .rules-section { margin-bottom: var(--space-2xl); }
  .logs-section { margin-top: var(--space-xl); }
  .rules-list, .logs-list { display: flex; flex-direction: column; gap: var(--space-sm); }

  .rule-row {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-md) var(--space-lg);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-md);
  }

  .rule-info { display: flex; flex-direction: column; gap: var(--space-xs); flex: 1; }
  .rule-description { font-family: var(--font-body); font-size: 13px; color: var(--text); }
  .rule-condition { font-family: var(--font-body); font-size: 11px; color: var(--text-muted); }
  .rule-agent { font-family: var(--font-body); font-size: 13px; color: var(--text-muted); flex-shrink: 0; }

  .empty-state { text-align: center; padding: var(--space-2xl) 0; }
  .empty-heading { font-family: var(--font-body); font-size: 13px; color: var(--text); margin-bottom: var(--space-xs); }
  .empty-body { font-family: var(--font-body); font-size: 13px; color: var(--text-muted); }
  .inline-error { font-family: var(--font-body); font-size: 13px; color: var(--error); margin-bottom: var(--space-md); }

  /* OpenAPI import */
  .import-form { display: flex; gap: var(--space-sm); margin-bottom: var(--space-xl); }

  .text-input {
    flex: 1;
    min-height: 40px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 0 var(--space-lg);
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
    outline: none;
    transition: border-color 0.15s ease;
  }
  .text-input:focus { border-color: var(--accent); }
  .text-input:disabled { opacity: 0.5; }
  .text-input::placeholder { color: var(--text-muted); opacity: 0.6; }

  .preview-panel {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-xl);
    overflow: hidden;
  }

  .preview-header {
    padding: var(--space-lg);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-md);
  }

  .preview-meta { display: flex; align-items: baseline; gap: var(--space-sm); flex-wrap: wrap; }
  .preview-title { font-family: var(--font-body); font-size: 14px; font-weight: 500; color: var(--text); margin: 0; }
  .preview-version { font-family: var(--font-label); font-size: 6px; color: var(--accent); letter-spacing: 0.08em; }
  .preview-base { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); }
  .preview-actions { display: flex; gap: var(--space-sm); }

  .endpoint-list { max-height: 440px; overflow-y: auto; }

  .endpoint-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-lg);
    border: none;
    background: transparent;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
    text-align: left;
    transition: background 0.1s ease;
    border-bottom: 1px solid var(--border);
  }
  .endpoint-row:last-child { border-bottom: none; }
  .endpoint-row:hover { background: var(--accent-dim); }
  .endpoint-row.deselected { opacity: 0.4; }

  .endpoint-check { font-size: 16px; color: var(--accent); flex-shrink: 0; width: 20px; }
  .endpoint-method { font-family: var(--font-label); font-size: 7px; letter-spacing: 0.06em; flex-shrink: 0; width: 52px; text-align: left; }
  .endpoint-path { font-family: var(--font-mono); font-size: 12px; color: var(--text); flex-shrink: 0; }
  .endpoint-summary { font-size: 12px; color: var(--text-muted); margin-left: var(--space-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }

  .registry-section { margin-top: var(--space-2xl); }

  .spec-group {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-md);
    overflow: hidden;
  }

  .spec-group-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md) var(--space-lg);
    cursor: pointer;
    transition: background 0.1s ease;
  }
  .spec-group-header:hover { background: var(--accent-dim); }

  .spec-group-meta { display: flex; align-items: baseline; gap: var(--space-sm); flex-wrap: wrap; }
  .spec-group-title { font-family: var(--font-body); font-size: 14px; font-weight: 500; color: var(--text); }
  .spec-group-version { font-family: var(--font-label); font-size: 6px; color: var(--accent); letter-spacing: 0.08em; }
  .spec-group-count { font-size: 12px; color: var(--text-muted); }
  .spec-group-actions { display: flex; align-items: center; gap: var(--space-md); }
  .expand-icon { font-size: 10px; color: var(--text-muted); }

  .spec-group-body { border-top: 1px solid var(--border); }

  .registry-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-lg);
    border-bottom: 1px solid var(--border);
    font-size: 13px;
    color: var(--text);
  }
  .registry-row:last-child { border-bottom: none; }
  .registry-row.disabled-row { opacity: 0.4; }

  /* Buttons */
  .btn-primary {
    min-height: 38px;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    color: white;
    background: var(--accent);
    border: 1px solid var(--accent);
    border-radius: var(--radius-md);
    padding: 0 var(--space-lg);
    cursor: pointer;
    transition: opacity 0.15s;
    white-space: nowrap;
  }
  .btn-primary:hover:not(:disabled) { opacity: 0.85; }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn-outline {
    min-height: 36px;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--accent);
    background: transparent;
    border: 1px solid var(--accent);
    border-radius: var(--radius-md);
    padding: 0 var(--space-lg);
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }
  .btn-outline:hover:not(:disabled) { background: var(--accent-dim); }
  .btn-outline:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn-outline.btn-teal { border-color: var(--accent-teal, #2DD4BF); color: var(--accent-teal, #2DD4BF); }
  .btn-outline.btn-teal:hover:not(:disabled) { background: rgba(45, 212, 191, 0.08); }
  .btn-outline.btn-rose { border-color: var(--rose, #F472B6); color: var(--rose, #F472B6); }
  .btn-outline.btn-rose:hover:not(:disabled) { background: rgba(244, 114, 182, 0.08); }

  .btn-small {
    min-height: 30px;
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 0 var(--space-md);
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .btn-small:hover { border-color: var(--accent); color: var(--text); }
  .btn-small.copied { border-color: var(--success); color: var(--success); }

  .btn-text-danger {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--error);
    background: transparent;
    border: none;
    cursor: pointer;
    padding: var(--space-xs) var(--space-sm);
    transition: opacity 0.15s;
    flex-shrink: 0;
  }
  .btn-text-danger:hover { opacity: 0.7; }

  .disconnect-confirm-btn {
    min-height: 44px;
    border: 1px solid var(--error);
    color: var(--error);
    background: transparent;
    border-radius: var(--radius-md);
    font-family: var(--font-body);
    font-size: 13px;
    cursor: pointer;
    padding: 0 var(--space-lg);
    margin-top: var(--space-md);
    transition: background 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }
  .disconnect-confirm-btn:hover { background: rgba(248, 113, 113, 0.08); }

  /* Simulator / simulation */
  .simulator-form { display: flex; flex-direction: column; gap: var(--space-md); margin: var(--space-md) 0; }
  .form-field { display: flex; flex-direction: column; gap: var(--space-xs); }
  .form-field label { font-family: var(--font-body); font-size: 13px; font-weight: 500; color: var(--text); }

  .select-input {
    min-height: 40px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-body);
    font-size: 13px;
    padding: 0 var(--space-sm);
    cursor: pointer;
  }
  .select-input:focus { outline: 1px solid var(--accent-teal); border-color: var(--accent-teal); }

  .payload-preview {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-sm);
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
    overflow-x: auto;
    max-height: 200px;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .simulation-result {
    border-radius: var(--radius-md);
    padding: var(--space-md);
    margin-top: var(--space-sm);
  }
  .simulation-result.matched { background: rgba(45, 212, 191, 0.08); border: 1px solid var(--accent-teal, #2DD4BF); }
  .simulation-result.not-matched { background: rgba(244, 114, 182, 0.08); border: 1px solid var(--rose, #F472B6); }

  .result-title { font-family: var(--font-body); font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: var(--space-xs); }
  .result-detail { font-family: var(--font-body); font-size: 13px; color: var(--text); }
  .dry-run-note { font-family: var(--font-body); font-size: 11px; color: var(--text-muted); font-style: italic; margin-top: var(--space-sm); }

  @media (max-width: 768px) {
    .section-tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .section-tab { padding: 8px 12px; font-size: 12px; white-space: nowrap; }
    .import-form { flex-direction: column; }
    .webhook-url-row { flex-direction: column; align-items: flex-start; }
    .rule-row { flex-direction: column; align-items: flex-start; }
  }
</style>
