import type { InfrastructureResource, Agent } from './types';

export function generateAlchemyConfig(
  projectName: string,
  resources: InfrastructureResource[],
  agents: Agent[]
): string {
  const enabledResources = resources.filter(r => r.enabled);

  const imports = new Set<string>();
  const declarations: string[] = [];
  const doDeclarations: string[] = [];
  const workerBindings: string[] = [];
  const sveltekitBindings: string[] = [];

  // Process resources in order (DOs first, then workers, then SvelteKit)
  const doResources = enabledResources.filter(r => r.type === 'durable-object');
  const otherResources = enabledResources.filter(r => r.type !== 'durable-object');

  // Generate Durable Objects first
  doResources.forEach(resource => {
    imports.add('DurableObjectNamespace');
    const doName = resource.config.className || 'MyDO';
    const doVar = `${doName.toUpperCase()}_DO`;
    doDeclarations.push(`const ${doVar} = DurableObjectNamespace(\`${projectName}-do\`, {
  className: "${doName}",
  scriptName: \`${projectName}-worker\`,
  sqlite: ${resource.config.sqlite !== false}
});`);
    workerBindings.push(`    ${doVar}`);
  });

  // Process other resources
  otherResources.forEach(resource => {
    switch (resource.type) {
      case 'worker':
        imports.add('Worker');
        break;
      case 'd1':
        imports.add('D1Database');
        declarations.push(`const DB = await D1Database(\`${projectName}-db\`, {
  name: \`${projectName}-db\`,
  migrationsDir: "migrations",
  adopt: true,
});`);
        sveltekitBindings.push('    DB');
        workerBindings.push('    DB');
        break;
      case 'r2':
        imports.add('R2Bucket');
        const r2Name = resource.config.name || 'bucket';
        const r2Var = r2Name.toUpperCase().replace(/-/g, '_');
        declarations.push(`const ${r2Var} = await R2Bucket(\`${projectName}-${r2Name}\`, {
  name: \`${projectName}-${r2Name}\`
});`);
        workerBindings.push(`    ${r2Var}`);
        break;
      case 'kv':
        imports.add('KVNamespace');
        const kvName = resource.config.name || 'kv';
        const kvVar = kvName.toUpperCase().replace(/-/g, '_');
        declarations.push(`const ${kvVar} = await KVNamespace(\`${projectName}-${kvName}\`, {
  name: \`${projectName}-${kvName}\`
});`);
        workerBindings.push(`    ${kvVar}`);
        break;
      case 'sveltekit':
        imports.add('SvelteKit');
        break;
    }
  });

  // Generate Worker if needed
  const hasWorker = enabledResources.some(r => r.type === 'worker');
  if (hasWorker || doResources.length > 0) {
    imports.add('Worker');
    declarations.push(`export const WORKER = await Worker(\`${projectName}-worker\`, {
  name: \`${projectName}-worker\`,
  entrypoint: "./worker/index.ts",
  adopt: true,
  bindings: {
${workerBindings.length > 0 ? workerBindings.join(',\n') : '    // No bindings'}
  },
  url: false
});`);
  }

  // Generate SvelteKit if needed
  const hasSvelteKit = enabledResources.some(r => r.type === 'sveltekit');
  if (hasSvelteKit) {
    declarations.push(`export const APP = await SvelteKit(\`${projectName}-app\`, {
  name: \`${projectName}-app\`,
  bindings: {
${sveltekitBindings.length > 0 ? sveltekitBindings.join(',\n') : '    // No bindings'}
  },
  url: true,
  adopt: true,
  env: {
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "",
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "http://localhost:5173",
  }
});`);
  }

  const header = `import alchemy from "alchemy";
import { 
  ${Array.from(imports).sort().join(',\n  ')}
} from "alchemy/cloudflare";

const projectName = "${projectName}";

const project = await alchemy(projectName, {
  password: process.env.ALCHEMY_PASSWORD || "default-password"
});`;

  const footer = `await project.finalize();`;

  const allDeclarations = [...doDeclarations, ...declarations];

  return [header, ...allDeclarations, footer].join('\n\n');
}

