import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const promptsDir = resolve(__dirname, 'prompts');

function loadPrompt(filename: string): string {
  return readFileSync(resolve(promptsDir, filename), 'utf-8');
}

export const persona = loadPrompt('persona.md');
export const analysisProtocol = loadPrompt('analysis-protocol.md');
export const outputFormat = loadPrompt('output-format.md');
