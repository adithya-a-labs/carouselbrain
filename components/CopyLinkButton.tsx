'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="secondary" size="sm" onClick={copy}>
      {copied ? 'Copied!' : 'Copy link'}
    </Button>
  );
}
