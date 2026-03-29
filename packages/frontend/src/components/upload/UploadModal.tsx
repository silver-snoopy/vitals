import { useState } from 'react';
import type { ReactElement } from 'react';
import { Heart } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AppleHealthUploader } from './AppleHealthUploader';
import { isNative } from '@/native/capacitor';
import { isHealthKitAvailable } from '@/native/health';
import { useHealthKitSync } from '@/api/hooks/useHealthKitSync';
import { toast } from 'sonner';

interface Props {
  trigger: ReactElement;
}

export function UploadModal({ trigger }: Props) {
  const [open, setOpen] = useState(false);
  const { syncHealthData } = useHealthKitSync();

  const handleHealthKitSync = async () => {
    toast.info('Syncing health data...');
    const success = await syncHealthData();
    if (success) {
      toast.success('Health data synced successfully');
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Base UI uses render prop instead of asChild */}
      <DialogTrigger render={trigger} />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isNative() ? 'Sync Health Data' : 'Upload Apple Health Data'}</DialogTitle>
        </DialogHeader>

        {isHealthKitAvailable() ? (
          <div className="flex flex-col gap-3">
            <Button onClick={handleHealthKitSync} className="gap-2">
              <Heart className="h-4 w-4" />
              Sync from Apple Health
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Automatically reads your latest health data from Apple Health.
            </p>
          </div>
        ) : (
          <AppleHealthUploader onSuccess={() => setOpen(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
