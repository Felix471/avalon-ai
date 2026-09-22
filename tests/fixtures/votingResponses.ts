// Raw provider responses captured on 2026-09-22 with real keys against
// buildVotingPrompt on a synthetic 5-player state (signatures shortened).
// They document the shapes that broke or nearly broke voting.

/** claude-sonnet-5, loyal voter, full prompt: a single text block. */
export const anthropicPlainText = {
  model: 'claude-sonnet-5',
  id: 'msg_011CfJmEbTrR7AYejL3ybbT4',
  type: 'message',
  role: 'assistant',
  content: [{ type: 'text', text: 'APPROVE' }],
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: { input_tokens: 249, output_tokens: 7, output_tokens_details: { thinking_tokens: 0 } },
};

/**
 * claude-sonnet-5, assassin voter, full prompt: adaptive thinking put an (empty,
 * display-omitted) thinking block FIRST, so content[0].text was undefined.
 */
export const anthropicThinkingThenText = {
  model: 'claude-sonnet-5',
  type: 'message',
  role: 'assistant',
  content: [
    { type: 'thinking', thinking: '', signature: 'EocDCpABCBIYAipAE6ao...' },
    { type: 'text', text: 'REJECT' },
  ],
  stop_reason: 'end_turn',
  usage: { input_tokens: 260, output_tokens: 64 },
};

/**
 * claude-sonnet-5, assassin voter, naive prompt: the whole 300-token budget went
 * to thinking; no text block at all.
 */
export const anthropicThinkingOnlyMaxTokens = {
  model: 'claude-sonnet-5',
  type: 'message',
  role: 'assistant',
  content: [{ type: 'thinking', thinking: '', signature: 'EtYICpABCBIYAipA9VF5...' }],
  stop_reason: 'max_tokens',
  usage: { input_tokens: 180, output_tokens: 300 },
};

/** gemini-3.8-flash: text part carries a thoughtSignature; thoughts were not returned as parts here. */
export const googleWithThoughtSignature = {
  candidates: [
    {
      content: {
        role: 'model',
        parts: [{ text: 'APPROVE', thoughtSignature: 'EsEDCr4DAWkUfRM9nMbv...' }],
      },
      finishReason: 'STOP',
    },
  ],
  usageMetadata: { promptTokenCount: 174, candidatesTokenCount: 2, thoughtsTokenCount: 76 },
};

/** Synthetic: Gemini returning a thought part before the answer (thought: true must be ignored). */
export const googleThoughtPartThenText = {
  candidates: [
    {
      content: {
        role: 'model',
        parts: [
          { text: '分析：队伍里有可疑玩家。', thought: true },
          { text: 'REJECT' },
        ],
      },
      finishReason: 'STOP',
    },
  ],
};

/** gpt-5.4-mini, deepseek-flash, grok-4.3: plain chat-completions text. */
export const openAiStyleTexts = {
  openai: 'REJECT',
  deepseek: 'APPROVE',
  xai: 'APPROVE',
};
