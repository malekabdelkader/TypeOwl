/**
 * 🦉 TypeOwl Type Sync Script
 * 
 * This script loads typeowl.config.ts and syncs types from configured backends.
 * 
 * Usage:
 *   npm run typeowl:sync        # One-time sync
 *   npm run typeowl:watch       # Watch mode (polls for changes)
 */

import { syncFromConfig, watchFromConfig } from 'typeowl/client';
import config from '../typeowl.config.js';

const args = process.argv.slice(2);
const watchMode = args.includes('--watch');

if (watchMode) {
  // Override config to enable watch mode
  await watchFromConfig({
    ...config,
    watch: 5000,
  });
} else {
  // One-shot sync
  const results = await syncFromConfig(config);
  
  // Check if all resolvers succeeded
  const allSuccess = Object.values(results).every(r => r.success);
  
  if (!allSuccess) {
    console.log(`\x1b[33m⚠ Some resolvers failed. Check if backends are running.\x1b[0m\n`);
    // Don't exit with error - allow dev to continue with cached types
  }
}
