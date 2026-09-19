import { AUTOMATIONS } from './automationRegistry.js';

// Runs an automation in dry-run mode: nothing is claimed, sent or recorded.
export async function runDigestPreview(key, auto) {
  return AUTOMATIONS[key].run(auto, { now: new Date(), dryRun: true });
}
