export type AgentId = 'codex' | 'cursor-agent' | 'claude' | 'opencode' | 'droid';

export type InfrastructureType = 'worker' | 'durable-object' | 'd1' | 'r2' | 'kv' | 'sveltekit' | 'queue' | 'vectorize';

export type InfrastructureId = 'worker' | 'durable-object' | 'd1-database' | 'r2-bucket' | 'kv-namespace' | 'sveltekit-app' | 'queue' | 'vectorize';

export interface Agent {
  id: AgentId;
  name: string;
  description: string;
  enabled: boolean;
  installCommands: string[];
  docsUrl?: string;
  logoUrl?: string;
}

export interface InfrastructureResource {
  id: InfrastructureId;
  name: string;
  description: string;
  type: InfrastructureType;
  enabled: boolean;
  config: Record<string, any>;
  icon?: string;
  docsUrl?: string;
}

export interface DockerfileConfig {
  baseImage: string;
  workdir: string;
  agents: Agent[];
}

export interface InfrastructureConfig {
  projectName: string;
  resources: InfrastructureResource[];
}
