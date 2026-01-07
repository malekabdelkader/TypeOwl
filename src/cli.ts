#!/usr/bin/env node
/**
 * 🦉 TypeOwl CLI
 * 
 * Commands:
 *   typeowl sync     - Sync types from remote backends (CLIENT-SIDE)
 *   typeowl watch    - Watch mode with polling (CLIENT-SIDE)
 *   typeowl generate - Generate static type files (SERVER-SIDE)
 */

import { resolve, dirname } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Get version from package.json
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dirname, '../package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
const VERSION = pkg.version;

// Colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[91m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  brightBlue: '\x1b[94m',
  brightCyan: '\x1b[96m',
  white: '\x1b[97m',
};

// ASCII Art Logo - Owl with lightning bolt
function printLogo(subtitle?: string) {
  const d = c.dim;
  const r = c.reset;
  const ASCII_ART = `                                              
                                              
  ░▓▓░░         ░░▒▓▓▓▓▓▓▓▓▓▓▒░░        ░░░▓▓  
   ▓▓▒▓▓▓▒▒ ░▒▓▓▓▒           ░▓▓▓▓▒░ ▒▒▓▓▓ ▓▓░ 
   ░▓▒   ░▒▓▓▓░░                 ▒▓▓▒▒░   ▓▓░  
    ░▓▒▒░     ▒▓▓▒▒          ▒▒▓▓░      ▒▓▒    
      ░▓▓▓▒      ░▒▓▓░    ░▓▓▒░     ▒▓▓▓▓      
      ▓▒  ░░▓▓░░    ▒▓▓░░▓▒░    ░▒▓▓▒░ ░▒▓     
     ▒▓░  ░▓░ ▒▓▓▒    ▒▓▒░   ▒▒▓▓░░▓▓   ░▓▒    
     ▒▒░  ▓▓░   ░▓▒▓▒     ░▒▓▒▒░   ░▓   ░▓▒    
    ░▓▓░   ▓▓▒▒▒▓░  ░▓▒░▒▓▓░  ▒▓▒▒▒▓░   ░▓▒    
    ▒▓▓▓░     ▒      ░▒▓▓▒      ░▒     ░▓▓▒    
    ▒▓▒▒▓░          ░░░░░░           ░▒▓▒▒▒    
    ▒▓▒  ▒▓▒▒▒░    ░░░░░░░       ▒▒▒▓▓▒  ▒▒    
    ░▓▒     ░▓    ░░░░░░░░░░░░   ▓▓░     ▒▒    
     ▒▒     ░▓░   ░░░░░░░░░░     ▓▓░    ░▓▒    
     ▒▓░    ░▓▓       ░░░░░      ▓▒░    ▒▓     
      ▓▓░    ▒▓▒     ░░░░       ▒▓▒    ▒▓░     
       ▓▓▒    ▒▒░    ░░░       ▒▓▒    ▒▓░      
        ░▒▒    ▒▓░  ░░░      ░▓▓▒   ▒▓▒░       
          ░▓▓▒     ░░░     ░▓▓▒   ▒▓▓░         
            ░▒▓▓▒ ░░     ▓▓▒▒ ░▓▓▒░            
                  ░  ▒▓▓▓▓▓▓▓▓▒░               
                     ░▓▓▓▓░                    
                                               `;
console.log(ASCII_ART);
  console.log(`                 ${c.cyan}${c.bold}T Y P E O W L${r}${r}
${subtitle ? `       ${d}${subtitle}${r}\n` : ''}`);
}

function printHelp() {
  printLogo();
  console.log(`

${c.bold}Usage:${c.reset}
  typeowl <command> [options]

${c.bold}Commands:${c.reset}
  ${c.green}sync${c.reset}      ${c.blue}[CLIENT]${c.reset} Sync types from remote backends (one-time)
  ${c.green}watch${c.reset}     ${c.blue}[CLIENT]${c.reset} Watch mode - continuously poll for type changes
  ${c.green}generate${c.reset}  ${c.magenta}[SERVER]${c.reset} Generate static type files for production

${c.bold}Options:${c.reset}
  --config, -c    Path to config file
  --interval, -i  Watch interval in seconds (default: 5)
  --help, -h      Show this help message
  --version       Show version

${c.bold}Examples:${c.reset}
  ${c.dim}# On your frontend/client - sync types from backend${c.reset}
  typeowl sync

  ${c.dim}# On your frontend/client - watch for changes (polls every 10 seconds)${c.reset}
  typeowl watch --interval 10

  ${c.dim}# On your frontend/client - watch with 1 minute interval${c.reset}
  typeowl watch -i 60

  ${c.dim}# On your backend/server - generate static types${c.reset}
  typeowl generate

${c.bold}Where to run:${c.reset}
  ${c.blue}sync/watch${c.reset}  → Run on ${c.bold}client/frontend${c.reset} to fetch types from remote server
              Uses ${c.yellow}typeowl.config.ts${c.reset}

  ${c.magenta}generate${c.reset}   → Run on ${c.bold}server/backend${c.reset} to export types as static files
              Uses ${c.yellow}typeowl.server.config.ts${c.reset}

  ${c.dim}Note: If your project is a monorepo or serves both roles,
        you can run any command from the appropriate directory.${c.reset}

${c.bold}Config files:${c.reset}
  ${c.yellow}typeowl.config.ts${c.reset} (client):
  ${c.dim}import { defineConfig } from 'typeowl';
  export default defineConfig({
    resolvers: 'http://localhost:3001/__typeowl',
    output: './.typeowl',
  });${c.reset}

  ${c.yellow}typeowl.server.config.ts${c.reset} (server):
  ${c.dim}import { defineServerConfig } from 'typeowl/server';
  export default defineServerConfig({
    typeSources: './src/types/',
    extract: { main: { from: './src/types/', types: '*' } },
  });${c.reset}
`);
}

async function loadConfig(configPath?: string) {
  const possiblePaths = configPath 
    ? [configPath]
    : [
        'typeowl.config.ts',
        'typeowl.config.js',
        'typeowl.config.mjs',
      ];
  
  for (const configFile of possiblePaths) {
    const fullPath = resolve(process.cwd(), configFile);
    if (existsSync(fullPath)) {
      try {
        const configModule = await import(fullPath);
        return configModule.default;
      } catch (e) {
        console.error(`${c.red}✗${c.reset} Failed to load config: ${configFile}`);
        console.error(`  ${c.dim}${e}${c.reset}`);
        process.exit(1);
      }
    }
  }
  
  console.error(`${c.red}✗${c.reset} No client config file found.`);
  console.error(`\n${c.bold}${c.blue}sync${c.reset} and ${c.blue}watch${c.reset} are client-side commands.`);
  console.error(`They should be run on your ${c.bold}frontend/client${c.reset} project.`);
  console.error(`\nCreate ${c.yellow}typeowl.config.ts${c.reset} in your project root:`);
  console.error(`
${c.dim}// typeowl.config.ts${c.reset}
import { defineConfig } from 'typeowl';

export default defineConfig({
  resolvers: 'http://localhost:3001/__typeowl',
  output: './.typeowl',
});

${c.dim}If this IS your frontend project, create the config above.
If you meant to generate types on the server, use: ${c.reset}${c.magenta}typeowl generate${c.reset}
`);
  process.exit(1);
}

async function runSync(configPath?: string) {
  printLogo('Syncing types from remote...');
  
  const config = await loadConfig(configPath);
  
  // Dynamic import to avoid loading client code at startup
  const { syncFromConfig } = await import('./client/index.js');
  
  const results = await syncFromConfig(config);
  
  const allSuccess = Object.values(results).every(r => r.success);
  
  if (!allSuccess) {
    console.log(`${c.yellow}⚠${c.reset} Some resolvers failed. Check if backends are running.\n`);
    process.exit(1);
  }
}

async function runWatch(configPath?: string, intervalSeconds: number = 5) {
  const intervalMs = intervalSeconds * 1000;
  
  printLogo(`Watching for changes (every ${intervalSeconds}s)`);
  
  const config = await loadConfig(configPath);
  
  const { watchFromConfig } = await import('./client/index.js');
  
  await watchFromConfig({
    ...config,
    watch: intervalMs,
  });
}

async function runGenerate(configPath?: string) {
  printLogo('Generating static types...');
  
  // Server-side generation
  const serverConfigPaths = configPath 
    ? [configPath]
    : [
        'typeowl.server.config.ts',
        'typeowl.server.config.js',
      ];
  
  let serverConfig = null;
  let loadedPath = '';
  
  for (const configFile of serverConfigPaths) {
    const fullPath = resolve(process.cwd(), configFile);
    if (existsSync(fullPath)) {
      try {
        const configModule = await import(fullPath);
        serverConfig = configModule.default;
        loadedPath = configFile;
        break;
      } catch {
        // Try next
      }
    }
  }
  
  if (!serverConfig) {
    console.error(`${c.red}✗${c.reset} No server config file found.`);
    console.error(`\n${c.bold}${c.magenta}generate${c.reset} is a server-side command.`);
    console.error(`It should be run on your ${c.bold}backend/server${c.reset} project.`);
    console.error(`\nCreate ${c.yellow}typeowl.server.config.ts${c.reset} in your project root:`);
    console.error(`
${c.dim}// typeowl.server.config.ts${c.reset}
import { defineServerConfig } from 'typeowl/server';

export default defineServerConfig({
  typeSources: './src/types/',
  extract: {
    main: { from: './src/types/', types: '*' },
  },
});

${c.dim}If this IS your backend project, create the config above.
If you meant to sync types on the client, use: ${c.reset}${c.blue}typeowl sync${c.reset}
`);
    process.exit(1);
  }
  
  console.log(`  ${c.dim}Config: ${loadedPath}${c.reset}\n`);
  
  const { createTypeOwlFromConfig } = await import('./server/index.js');
  
  const typeowl = createTypeOwlFromConfig(serverConfig);
  
  // Generate to output path (default: ./public/__typeowl or basePath)
  const outputPath = serverConfig.staticOutput ?? `./public${serverConfig.basePath ?? '/__typeowl'}`;
  
  await typeowl.generate(outputPath);
  
  console.log(`\n${c.green}✓${c.reset} Static types generated to ${c.dim}${outputPath}${c.reset}\n`);
}

function parseInterval(args: string[]): number {
  // Look for --interval or -i
  const intervalIndex = args.findIndex(a => a === '--interval' || a === '-i');
  if (intervalIndex !== -1 && args[intervalIndex + 1]) {
    const value = parseInt(args[intervalIndex + 1], 10);
    if (!isNaN(value) && value > 0) {
      return value;
    }
  }
  return 5; // Default 5 seconds
}

async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const command = args.find(a => !a.startsWith('-') && !args.some((arg, i) => 
    (arg === '--config' || arg === '-c' || arg === '--interval' || arg === '-i') && 
    args[i + 1] === a
  ));
  const flags = args.filter(a => a.startsWith('-'));
  
  // Find config path
  let configPath: string | undefined;
  const configIndex = args.findIndex(a => a === '--config' || a === '-c');
  if (configIndex !== -1 && args[configIndex + 1]) {
    configPath = args[configIndex + 1];
  }
  
  // Handle flags
  if (flags.includes('--help') || flags.includes('-h') || !command) {
    printHelp();
    process.exit(0);
  }
  
  if (flags.includes('--version') || flags.includes('-v')) {
    console.log(`typeowl v${VERSION}`);
    process.exit(0);
  }
  
  // Execute command
  switch (command) {
    case 'sync':
      await runSync(configPath);
      break;
      
    case 'watch': {
      const interval = parseInterval(args);
      await runWatch(configPath, interval);
      break;
    }
      
    case 'generate':
      await runGenerate(configPath);
      break;
      
    default:
      console.error(`${c.red}✗${c.reset} Unknown command: ${command}`);
      console.error(`  ${c.dim}Run 'typeowl --help' for usage.${c.reset}\n`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`${c.red}✗${c.reset} Error: ${err.message}`);
  process.exit(1);
});
