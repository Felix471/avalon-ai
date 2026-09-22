import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { callAIProvider } from '../lib/ai/dispatch';
import { AI_MODELS } from '../lib/game/types';

const ENV_VARS = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_API_KEY',
  'DEEPSEEK_API_KEY',
  'XAI_API_KEY',
] as const;

const collapseWhitespace = (text: string) => text.replace(/\s+/g, ' ').trim();
const cell = (value: string | number, width: number) => String(value).padEnd(width);

async function main(): Promise<void> {
  const missing = ENV_VARS.filter(name => !process.env[name]);
  console.log(`Missing env vars: ${missing.length > 0 ? missing.join(', ') : 'none'}`);
  console.log('');
  console.log(
    cell('id', 17) +
    cell('provider', 12) +
    cell('model', 25) +
    cell('result', 8) +
    cell('latencyMs', 12) +
    cell('attempts', 10) +
    'response',
  );

  let responded = 0;

  for (const model of AI_MODELS) {
    const result = await callAIProvider(model, 'Reply with the single word OK.', 'smoke');
    const detail = result.ok
      ? collapseWhitespace(result.text).slice(0, 40)
      : `error=${result.error} status=${result.status ?? '-'}`;

    if (result.ok) responded += 1;

    console.log(
      cell(model.id, 17) +
      cell(model.provider, 12) +
      cell(model.model, 25) +
      cell(result.ok ? 'ok' : 'FAIL', 8) +
      cell(result.latencyMs, 12) +
      cell(result.attempts, 10) +
      detail,
    );
  }

  console.log(`\n${responded}/${AI_MODELS.length} models responded`);
  process.exit(responded === AI_MODELS.length ? 0 : 1);
}

void main();
