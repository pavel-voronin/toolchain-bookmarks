import type { RuntimeConfig } from '../types/config';
import { runInboxLinks } from './inbox-links';
import { runSearchTitle } from './search-title';
import { runSearchUrl } from './search-url';

export type ScenarioRunner = (config: RuntimeConfig, argv: string[]) => unknown;

export const SCENARIOS = [
  { name: 'inbox-links', description: 'List links in Inbox folder' },
  { name: 'search-url', description: 'Find links by URL substring' },
  { name: 'search-title', description: 'Find links by title substring' }
] as const;

export const scenarioRegistry: Record<string, ScenarioRunner> = {
  'inbox-links': (config) => runInboxLinks(config),
  'search-url': (config, argv) => runSearchUrl(config, argv.join(' ')),
  'search-title': (config, argv) => runSearchTitle(config, argv.join(' '))
};

export function hasScenario(name: string): boolean {
  return Object.hasOwn(scenarioRegistry, name);
}
