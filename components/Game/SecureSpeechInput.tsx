'use client';

import { useState, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Send, Info } from 'lucide-react';
import {
  validateSpeechInput,
  quickSuspicionCheck,
  MAX_SPEECH_LENGTH
} from '@/lib/security/inputValidator';

interface SecureSpeechInputProps {
  onSubmit: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function SecureSpeechInput({
  onSubmit,
  disabled = false,
  placeholder = '输入你的发言...'
}: SecureSpeechInputProps) {
  const [input, setInput] = useState('');
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 实时检查输入
  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    setError(null);

    // 快速可疑检查（不阻塞输入，只是警告）
    if (quickSuspicionCheck(value)) {
      setWarning('⚠️ 检测到可疑内容，可能无法发送');
    } else if (value.length > MAX_SPEECH_LENGTH * 0.8) {
      setWarning(`接近字数限制 (${value.length}/${MAX_SPEECH_LENGTH})`);
    } else {
      setWarning(null);
    }
  }, []);

  // 提交时完整验证
  const handleSubmit = useCallback(() => {
    const validation = validateSpeechInput(input);

    if (!validation.isValid) {
      setError(validation.rejectionReason || '输入无效');
      return;
    }

    // 清空输入并提交
    setInput('');
    setWarning(null);
    setError(null);
    onSubmit(validation.sanitizedInput);
  }, [input, onSubmit]);

  // 快捷键提交
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const charCount = input.length;
  const isOverLimit = charCount > MAX_SPEECH_LENGTH;

  return (
    <div className="space-y-2">
      {/* 输入框 */}
      <div className="relative">
        <Textarea
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            min-h-[100px] pr-16 resize-none
            ${isOverLimit ? 'border-red-500 focus:ring-red-500' : ''}
            ${warning && !isOverLimit ? 'border-yellow-500 focus:ring-yellow-500' : ''}
          `}
        />

        {/* 字数统计 */}
        <div className={`
          absolute bottom-2 right-2 text-xs
          ${isOverLimit ? 'text-red-400' : 'text-slate-500'}
        `}>
          {charCount}/{MAX_SPEECH_LENGTH}
        </div>
      </div>

      {/* 警告信息 */}
      {warning && !error && (
        <div className="flex items-center gap-2 text-yellow-400 text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>{warning}</span>
        </div>
      )}

      {/* 错误信息 */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* 提交按钮和提示 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-slate-500 text-xs">
          <Info className="w-3 h-3" />
          <span>按 Enter 发送，Shift+Enter 换行</span>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={disabled || isOverLimit || input.trim().length === 0}
          size="sm"
          className="gap-2"
        >
          <Send className="w-4 h-4" />
          发言
        </Button>
      </div>

      {/* 安全提示（首次显示） */}
      <div className="text-xs text-slate-600 mt-2">
        💡 提示：发言内容仅用于游戏讨论，请勿输入与游戏无关的指令
      </div>
    </div>
  );
}