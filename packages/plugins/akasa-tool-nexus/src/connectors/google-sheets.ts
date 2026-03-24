import type { PluginContext, ToolResult } from '@paperclipai/plugin-sdk';
import { TOOL_NAMES } from '../constants.js';
import { logInvocation } from '../services/invocation-logger.js';
import { resolveCredential } from '../services/credential-bridge.js';

// ─── Google Sheets API types ──────────────────────────────────────────────────

interface SheetsValuesResponse {
  range?: string;
  majorDimension?: string;
  values?: string[][];
}

interface SheetsAppendResponse {
  spreadsheetId?: string;
  tableRange?: string;
  updates?: {
    spreadsheetId: string;
    updatedRange: string;
    updatedRows: number;
    updatedColumns: number;
    updatedCells: number;
  };
}

// ─── Tool registration ────────────────────────────────────────────────────────

export async function registerGoogleSheetsTools(ctx: PluginContext): Promise<void> {
  // ── sheets:read-range ───────────────────────────────────────────────────────
  ctx.tools.register(
    TOOL_NAMES.sheetsReadRange,
    {
      displayName: 'Google Sheets: Read Range',
      description: 'Reads data from a range in a Google Sheets spreadsheet. Returns a 2D array of cell values.',
      parametersSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string', description: 'Google Sheets spreadsheet ID (from URL)' },
          range: { type: 'string', description: 'A1 notation range (e.g. Sheet1!A1:D10)' },
        },
        required: ['spreadsheetId', 'range'],
      },
    },
    async (params, runCtx): Promise<ToolResult> => {
      const start = Date.now();
      const p = params as { spreadsheetId: string; range: string };
      let connectionId = '';

      try {
        const cred = await resolveCredential('google-sheets', runCtx.companyId);
        connectionId = cred.connectionId;

        const encodedRange = encodeURIComponent(p.range);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${p.spreadsheetId}/values/${encodedRange}`;

        const response = await ctx.http.fetch(url, {
          headers: { Authorization: `Bearer ${cred.token}` },
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Google Sheets API error ${response.status}: ${text}`);
        }

        const result = await response.json() as SheetsValuesResponse;
        const values = result.values ?? [];
        const latencyMs = Date.now() - start;

        await logInvocation({
          toolId: 'google-sheets',
          action: TOOL_NAMES.sheetsReadRange,
          agentId: runCtx.agentId ?? null,
          userId: runCtx.companyId,
          connectionId,
          latencyMs,
          success: true,
          requestSummary: JSON.stringify({ spreadsheetId: p.spreadsheetId, range: p.range }).slice(0, 500),
          responseSummary: JSON.stringify({ rows: values.length, range: result.range }).slice(0, 500),
        });

        return {
          content: `Read ${values.length} rows from ${result.range ?? p.range}`,
          data: { values, range: result.range },
        };
      } catch (err) {
        const latencyMs = Date.now() - start;
        await logInvocation({
          toolId: 'google-sheets',
          action: TOOL_NAMES.sheetsReadRange,
          agentId: runCtx.agentId ?? null,
          userId: runCtx.companyId,
          connectionId,
          latencyMs,
          success: false,
          errorMessage: (err as Error).message,
          requestSummary: JSON.stringify({ spreadsheetId: p.spreadsheetId, range: p.range }).slice(0, 500),
        });
        return { error: (err as Error).message };
      }
    },
  );

  // ── sheets:append-row ───────────────────────────────────────────────────────
  ctx.tools.register(
    TOOL_NAMES.sheetsAppendRow,
    {
      displayName: 'Google Sheets: Append Row',
      description: 'Appends a new row of data to the end of a Google Sheets spreadsheet.',
      parametersSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string', description: 'Google Sheets spreadsheet ID' },
          range: { type: 'string', description: 'Target sheet and optional range (e.g. Sheet1!A:D)' },
          values: { type: 'array', items: { type: 'string' }, description: 'Array of cell values for the new row' },
        },
        required: ['spreadsheetId', 'range', 'values'],
      },
    },
    async (params, runCtx): Promise<ToolResult> => {
      const start = Date.now();
      const p = params as { spreadsheetId: string; range: string; values: string[] };
      let connectionId = '';

      try {
        const cred = await resolveCredential('google-sheets', runCtx.companyId);
        connectionId = cred.connectionId;

        const encodedRange = encodeURIComponent(p.range);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${p.spreadsheetId}/values/${encodedRange}:append?valueInputOption=USER_ENTERED`;

        const response = await ctx.http.fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cred.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [p.values] }),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Google Sheets API error ${response.status}: ${text}`);
        }

        const result = await response.json() as SheetsAppendResponse;
        const updatedRange = result.updates?.updatedRange ?? p.range;
        const updatedRows = result.updates?.updatedRows ?? 1;
        const latencyMs = Date.now() - start;

        await logInvocation({
          toolId: 'google-sheets',
          action: TOOL_NAMES.sheetsAppendRow,
          agentId: runCtx.agentId ?? null,
          userId: runCtx.companyId,
          connectionId,
          latencyMs,
          success: true,
          requestSummary: JSON.stringify({ spreadsheetId: p.spreadsheetId, range: p.range, valueCells: p.values.length }).slice(0, 500),
          responseSummary: JSON.stringify({ updatedRange, updatedRows }).slice(0, 500),
        });

        return {
          content: `Appended ${updatedRows} row(s) to ${updatedRange}`,
          data: { updatedRange, updatedRows },
        };
      } catch (err) {
        const latencyMs = Date.now() - start;
        await logInvocation({
          toolId: 'google-sheets',
          action: TOOL_NAMES.sheetsAppendRow,
          agentId: runCtx.agentId ?? null,
          userId: runCtx.companyId,
          connectionId,
          latencyMs,
          success: false,
          errorMessage: (err as Error).message,
          requestSummary: JSON.stringify({ spreadsheetId: p.spreadsheetId, range: p.range }).slice(0, 500),
        });
        return { error: (err as Error).message };
      }
    },
  );
}
