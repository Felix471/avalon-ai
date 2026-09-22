/**
 * 输出验证器 - 检查 AI 回复是否符合预期
 *
 * 这是防御 Prompt Injection 的最后一道防线：
 * 即使 AI 被"说服"执行了其他任务，如果输出不符合预期格式，
 * 我们也可以检测到并拒绝这个回复
 */

// ==================== 验证结果类型 ====================

export interface OutputValidationResult {
  isValid: boolean;
  cleanedOutput: string;
  anomalyDetected: boolean;
  anomalyReason?: string;
}

// ==================== 发言输出验证 ====================

/**
 * 验证发言阶段 AI 的输出
 */
export function validateDiscussionOutput(output: string): OutputValidationResult {
  // 检查 1: 安全校验码（可选，取决于 prompt 设计）
  const hasValidationToken = output.includes('[AVALON_VALID]');
  let cleaned = output.replace('[AVALON_VALID]', '').trim();

  // 检查 2: 清理格式问题（GPT/Grok 常见问题）
  // 移除开头的 "玩家X：" 或 "玩家X:" 前缀
  cleaned = cleaned.replace(/^玩家\d+[：:]\s*/i, '');
  // 移除开头的 "Player X:" 前缀
  cleaned = cleaned.replace(/^Player\s*\d+[：:]\s*/i, '');
  // 移除包裹的中文引号「」（使用 [\s\S] 代替 . 以匹配换行符，兼容 ES5）
  cleaned = cleaned.replace(/^「([\s\S]*)」$/, '$1');
  // 移除包裹的中文引号『』
  cleaned = cleaned.replace(/^『([\s\S]*)』$/, '$1');
  // 移除包裹的英文引号 ""
  cleaned = cleaned.replace(/^"([\s\S]*)"$/, '$1');
  // 移除包裹的英文引号 ''
  cleaned = cleaned.replace(/^'([\s\S]*)'$/, '$1');

  cleaned = cleaned.trim();

  // 检查 3: 长度异常
  if (cleaned.length > 500) {
    return {
      isValid: false,
      cleanedOutput: cleaned.substring(0, 200) + '...',
      anomalyDetected: true,
      anomalyReason: 'AI 输出过长，可能被劫持',
    };
  }

  // 检查 4: 检测代码块（正常发言不应该包含代码）
  if (/```[\s\S]*```/.test(cleaned)) {
    return {
      isValid: false,
      cleanedOutput: '我觉得我们应该仔细讨论一下这个队伍。',
      anomalyDetected: true,
      anomalyReason: 'AI 输出包含代码块',
    };
  }

  // 检查 5: 检测 JSON 格式（可能是被诱导输出结构化数据）
  if (/^\s*\{[\s\S]*\}\s*$/.test(cleaned) || /^\s*\[[\s\S]*\]\s*$/.test(cleaned)) {
    return {
      isValid: false,
      cleanedOutput: '让我想想这个提议...',
      anomalyDetected: true,
      anomalyReason: 'AI 输出 JSON 格式',
    };
  }

  // 检查 6: 检测角色突破的迹象
  const breakoutPatterns = [
    /i('m| am) (an? )?ai/i,
    /我是(一个)?人工智能/i,
    /as an ai/i,
    /language model/i,
    /i cannot|i can't help/i,
    /i('m| am) not able to/i,
  ];

  for (const pattern of breakoutPatterns) {
    if (pattern.test(cleaned)) {
      return {
        isValid: false,
        cleanedOutput: '嗯...让我考虑一下当前的局势。',
        anomalyDetected: true,
        anomalyReason: 'AI 可能打破角色扮演',
      };
    }
  }

  // 检查 7: 检测敏感信息泄露
  const sensitivePatterns = [
    /system prompt/i,
    /my instructions/i,
    /i was told to/i,
    /我的指令/i,
    /系统提示/i,
  ];

  for (const pattern of sensitivePatterns) {
    if (pattern.test(cleaned)) {
      return {
        isValid: false,
        cleanedOutput: '我认为我们需要更多信息才能做出判断。',
        anomalyDetected: true,
        anomalyReason: 'AI 可能泄露系统信息',
      };
    }
  }

  // 通过所有检查
  return {
    isValid: true,
    cleanedOutput: cleaned,
    anomalyDetected: false,
  };
}

// ==================== Verdict helpers ====================

/** Returns whichever of `words` occurs last in `text` as a whole word, or null. */
function lastWholeWord(text: string, words: string[]): string | null {
  let best: { word: string; index: number } | null = null;
  for (const word of words) {
    const pattern = new RegExp(`\\b${word}\\b`, 'g');
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (!best || match.index > best.index) best = { word, index: match.index };
    }
  }
  return best?.word ?? null;
}

/** Returns the vote of the pattern whose last match occurs latest in `text`, or null. */
function lastMatch(text: string, candidates: Array<{ pattern: RegExp; vote: boolean }>): boolean | null {
  let best: { vote: boolean; index: number } | null = null;
  for (const candidate of candidates) {
    candidate.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = candidate.pattern.exec(text)) !== null) {
      if (!best || match.index > best.index) best = { vote: candidate.vote, index: match.index };
      if (match[0].length === 0) candidate.pattern.lastIndex++;
    }
  }
  return best?.vote ?? null;
}

// ==================== 投票输出验证 ====================

/**
 * 验证投票阶段 AI 的输出
 * 投票只能是 APPROVE 或 REJECT
 */
export function validateVotingOutput(output: string): {
  isValid: boolean;
  vote: boolean | null;
  anomalyDetected: boolean;
} {
  const cleaned = output.trim().toUpperCase();

  // Whole-word verdicts. When both appear (a model reasoning aloud and then
  // deciding), the last one wins.
  const verdict = lastWholeWord(cleaned, ['APPROVE', 'REJECT']);
  if (verdict === 'APPROVE') return { isValid: true, vote: true, anomalyDetected: false };
  if (verdict === 'REJECT') return { isValid: true, vote: false, anomalyDetected: false };

  // Loose matches (flagged as anomalies). English words are whole words so that
  // "cannot", "know", "another" never count as a "no".
  const loose = lastMatch(cleaned, [
    { pattern: /\b(YES|AGREE)\b|同意|赞成|通过/g, vote: true },
    { pattern: /\bNO\b|\bDISAGREE\b|反对|否决|不同意/g, vote: false },
  ]);
  if (loose !== null) return { isValid: true, vote: loose, anomalyDetected: true };

  // Unparseable: the caller must treat this as an error, never as a vote.
  return {
    isValid: false,
    vote: null,
    anomalyDetected: true
  };
}

// ==================== 任务行动输出验证 ====================

/**
 * 验证任务执行阶段 AI 的输出
 */
export function validateQuestActionOutput(output: string, isEvil: boolean): {
  isValid: boolean;
  success: boolean;
  anomalyDetected: boolean;
} {
  const cleaned = output.trim().toUpperCase();

  // 好人必须成功
  if (!isEvil) {
    return { isValid: true, success: true, anomalyDetected: false };
  }

  // 坏人可以选择 — last whole-word verdict wins.
  const verdict = lastWholeWord(cleaned, ['SUCCESS', 'FAIL']);
  if (verdict === 'SUCCESS') return { isValid: true, success: true, anomalyDetected: false };
  if (verdict === 'FAIL') return { isValid: true, success: false, anomalyDetected: false };

  // 无法解析，默认成功（更安全的选择）
  return { isValid: false, success: true, anomalyDetected: true };
}

// ==================== 日志记录（用于监控） ====================

/**
 * 记录可疑的 AI 交互
 * 在生产环境中，这应该发送到日志服务
 */
export function logSuspiciousActivity(
  playerId: number,
  action: string,
  input: string,
  output: string,
  reason: string
): void {
  void playerId;
  void action;
  void input;
  void output;
  void reason;
  return;
}
