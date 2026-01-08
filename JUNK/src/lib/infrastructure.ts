import type { InfrastructureResource } from './types';

export const INFRASTRUCTURE_RESOURCES: InfrastructureResource[] = [
  {
    id: 'worker',
    name: 'Worker',
    description: 'Cloudflare Worker for serverless compute',
    type: 'worker',
    enabled: true,
    config: {
      name: 'my-worker',
      entrypoint: './worker/index.ts',
      url: false
    },
    icon: 'Zap'
  },
  {
    id: 'durable-object',
    name: 'Durable Object',
    description: 'Stateful serverless with persistent storage',
    type: 'durable-object',
    enabled: false,
    config: {
      className: 'MyDO',
      scriptName: 'my-worker',
      sqlite: true
    },
    icon: 'Database'
  },
  {
    id: 'd1-database',
    name: 'D1 Database',
    description: 'SQLite database for structured data',
    type: 'd1',
    enabled: true,
    config: {
      name: 'my-db',
      migrationsDir: 'migrations',
      adopt: true
    },
    icon: 'Database'
  },
  {
    id: 'r2-bucket',
    name: 'R2 Bucket',
    description: 'S3-compatible object storage',
    type: 'r2',
    enabled: false,
    config: {
      name: 'my-bucket'
    },
    icon: 'Cloud'
  },
  {
    id: 'kv-namespace',
    name: 'KV Namespace',
    description: 'Key-value storage for caching',
    type: 'kv',
    enabled: false,
    config: {
      name: 'my-kv'
    },
    icon: 'Key'
  },
  {
    id: 'sveltekit-app',
    name: 'SvelteKit App',
    description: 'Full-stack SvelteKit application',
    type: 'sveltekit',
    enabled: true,
    config: {
      name: 'my-app',
      url: true,
      adopt: true
    },
    icon: 'Globe'
  },
  {
    id: 'queue',
    name: 'Queue',
    description: 'Message queue for async processing',
    type: 'queue',
    enabled: false,
    config: {
      name: 'my-queue'
    },
    icon: 'Inbox'
  },
  {
    id: 'vectorize',
    name: 'Vectorize',
    description: 'Vector database for AI/ML',
    type: 'vectorize',
    enabled: false,
    config: {
      name: 'my-vectorize',
      dimensions: 768
    },
    icon: 'Brain'
  }
];

export const INFRASTRUCTURE_TYPES = [
  { id: 'compute', name: 'Compute', icon: 'Zap' },
  { id: 'storage', name: 'Storage', icon: 'Database' },
  { id: 'database', name: 'Database', icon: 'Database' },
  { id: 'messaging', name: 'Messaging', icon: 'Inbox' }
] as const;

