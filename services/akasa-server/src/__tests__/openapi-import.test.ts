import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb, mockSwaggerParser } = vi.hoisted(() => ({
  mockDb: {
    insert: vi.fn(),
    select: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
  mockSwaggerParser: {
    dereference: vi.fn(),
  },
}));

vi.mock('@claw/db', () => ({
  db: mockDb,
  toolRegistry: {
    userId: 'userId',
    specId: 'specId',
    id: 'id',
    isEnabled: 'isEnabled',
    updatedAt: 'updatedAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ _type: 'eq', args }),
  and: (...args: unknown[]) => ({ _type: 'and', args }),
}));

vi.mock('@apidevtools/swagger-parser', () => ({
  default: mockSwaggerParser,
}));

import {
  parseOpenApiSpec,
  importEndpoints,
  listToolRegistry,
  deleteSpec,
  toggleEndpoint,
} from '../services/openapi-import.js';

describe('openapi-import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseOpenApiSpec', () => {
    it('parses OpenAPI 3.x spec with servers array', async () => {
      mockSwaggerParser.dereference.mockResolvedValue({
        info: { title: 'Test API', version: '1.0.0' },
        servers: [{ url: 'https://api.example.com/v1' }],
        paths: {
          '/users': {
            get: {
              operationId: 'listUsers',
              summary: 'List users',
              tags: ['users'],
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: { type: 'array', items: { type: 'object' } },
                    },
                  },
                },
              },
            },
            post: {
              operationId: 'createUser',
              summary: 'Create user',
              tags: ['users'],
              requestBody: {
                content: {
                  'application/json': {
                    schema: { type: 'object', properties: { name: { type: 'string' } } },
                  },
                },
              },
              responses: {
                '201': {
                  content: {
                    'application/json': {
                      schema: { type: 'object' },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const result = await parseOpenApiSpec('https://api.example.com/spec.json');

      expect(result.title).toBe('Test API');
      expect(result.version).toBe('1.0.0');
      expect(result.baseUrl).toBe('https://api.example.com/v1');
      expect(result.endpoints).toHaveLength(2);

      const getEndpoint = result.endpoints.find((e) => e.method === 'get');
      expect(getEndpoint!.operationId).toBe('listUsers');
      expect(getEndpoint!.path).toBe('/users');
      expect(getEndpoint!.responseSchema).toBeDefined();

      const postEndpoint = result.endpoints.find((e) => e.method === 'post');
      expect(postEndpoint!.requestBody).toBeDefined();
    });

    it('parses Swagger 2.x spec with host and basePath', async () => {
      mockSwaggerParser.dereference.mockResolvedValue({
        info: { title: 'Legacy API' },
        host: 'api.legacy.com',
        basePath: '/v2',
        schemes: ['https'],
        paths: {
          '/items': {
            get: {
              operationId: 'listItems',
              responses: {
                '200': { schema: { type: 'array' } },
              },
            },
          },
        },
      });

      const result = await parseOpenApiSpec({});

      expect(result.title).toBe('Legacy API');
      expect(result.baseUrl).toBe('https://api.legacy.com/v2');
      expect(result.version).toBeNull();
      expect(result.endpoints).toHaveLength(1);
    });

    it('throws when info.title is missing', async () => {
      mockSwaggerParser.dereference.mockResolvedValue({
        info: {},
        paths: {},
      });

      await expect(parseOpenApiSpec('url')).rejects.toThrow('missing required info.title');
    });

    it('throws when no base URL can be resolved', async () => {
      mockSwaggerParser.dereference.mockResolvedValue({
        info: { title: 'No URL API' },
        paths: {},
      });

      await expect(parseOpenApiSpec('url')).rejects.toThrow('Could not resolve base URL');
    });

    it('merges path-level and operation-level parameters', async () => {
      mockSwaggerParser.dereference.mockResolvedValue({
        info: { title: 'Params API', version: '1.0' },
        servers: [{ url: 'https://api.example.com' }],
        paths: {
          '/users/{id}': {
            parameters: [{ name: 'id', in: 'path' }],
            get: {
              operationId: 'getUser',
              parameters: [{ name: 'fields', in: 'query' }],
              responses: {},
            },
          },
        },
      });

      const result = await parseOpenApiSpec('url');
      expect(result.endpoints[0]!.parameters).toHaveLength(2);
    });
  });

  describe('importEndpoints', () => {
    it('inserts all endpoints when no selection filter is provided', async () => {
      const parsedSpec = {
        title: 'API',
        version: '1.0',
        baseUrl: 'https://api.example.com',
        endpoints: [
          { operationId: 'op1', method: 'get', path: '/a', summary: null, description: null, parameters: null, requestBody: null, responseSchema: null, tags: [] },
          { operationId: 'op2', method: 'post', path: '/b', summary: null, description: null, parameters: null, requestBody: null, responseSchema: null, tags: [] },
        ],
      };

      const inserted = [{ id: 'entry-1' }, { id: 'entry-2' }];
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(inserted),
        }),
      });

      const result = await importEndpoints('user-1', parsedSpec, 'https://spec.url');

      expect(result).toHaveLength(2);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('filters to selected paths when provided', async () => {
      const parsedSpec = {
        title: 'API',
        version: '1.0',
        baseUrl: 'https://api.example.com',
        endpoints: [
          { operationId: 'op1', method: 'get', path: '/a', summary: null, description: null, parameters: null, requestBody: null, responseSchema: null, tags: [] },
          { operationId: 'op2', method: 'post', path: '/b', summary: null, description: null, parameters: null, requestBody: null, responseSchema: null, tags: [] },
        ],
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'entry-1' }]),
        }),
      });

      const result = await importEndpoints('user-1', parsedSpec, null, [{ method: 'get', path: '/a' }]);

      expect(result).toHaveLength(1);
    });

    it('returns empty array when no endpoints match selection', async () => {
      const parsedSpec = {
        title: 'API',
        version: '1.0',
        baseUrl: 'https://api.example.com',
        endpoints: [
          { operationId: 'op1', method: 'get', path: '/a', summary: null, description: null, parameters: null, requestBody: null, responseSchema: null, tags: [] },
        ],
      };

      const result = await importEndpoints('user-1', parsedSpec, null, [{ method: 'delete', path: '/z' }]);

      expect(result).toEqual([]);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('listToolRegistry', () => {
    it('queries by userId', async () => {
      const mockRows = [{ id: 'entry-1' }];
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockRows),
        }),
      });

      const result = await listToolRegistry('user-1');
      expect(result).toEqual(mockRows);
    });
  });

  describe('deleteSpec', () => {
    it('returns count of deleted rows', async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]),
        }),
      });

      const count = await deleteSpec('user-1', 'spec-1');
      expect(count).toBe(2);
    });
  });

  describe('toggleEndpoint', () => {
    it('returns updated entry on success', async () => {
      const updated = { id: 'entry-1', isEnabled: true };
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

      const result = await toggleEndpoint('user-1', 'entry-1', true);
      expect(result).toEqual(updated);
    });

    it('returns null when no entry matches', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await toggleEndpoint('user-1', 'nonexistent', false);
      expect(result).toBeNull();
    });
  });
});
