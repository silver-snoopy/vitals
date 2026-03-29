import { useState, useEffect } from 'react';
import { Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const IOS_PROMPT_DISMISSED_KEY = 'vitals-ios-prompt-dismissed';

function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  const isStandalone =
    'standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true;
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari && !isStandalone;
}

export function IosInstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIosSafari()) return;
    const dismissed = localStorage.getItem(IOS_PROMPT_DISMISSED_KEY);
    if (!dismissed) {
      const timer = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(IOS_PROMPT_DISMISSED_KEY, 'true');
  };

  if (!show) return null;

  return (
    <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
      <div className="flex-1 text-sm">
        <p className="font-medium">Install Vitals</p>
        <p className="text-muted-foreground">
          Tap <Share className="inline h-4 w-4" /> then &quot;Add to Home Screen&quot; for the best
          experience.
        </p>
      </div>
      <Button variant="ghost" size="icon" onClick={dismiss} aria-label="Dismiss install prompt">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
