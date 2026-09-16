"use client";

import { useState } from "react";

export function CopyButton({ value, label = "Copy", copiedLabel = "Copied", className = "", testId }: { value: string; label?: string; copiedLabel?: string; className?: string; testId?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (insecure context, permissions); the value is always visible next to the button.
      window.prompt("Copy this value", value);
    }
  }
  return (
    <button type="button" onClick={copy} data-testid={testId} aria-live="polite" className={`inline-flex items-center rounded-full border border-brand-black px-4 py-2 text-xs font-bold hover:border-brand-orange hover:text-brand-orange ${className}`}>
      {copied ? copiedLabel : label}
    </button>
  );
}
