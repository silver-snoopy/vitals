import { useRef } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useUpload } from '@/api/hooks/useUpload';

interface Props {
  onSuccess: () => void;
}

export function AppleHealthUploader({ onSuccess }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync, isPending } = useUpload();

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.xml')) {
      toast.error('Please select an Apple Health export .xml file');
      return;
    }
    try {
      const result = await mutateAsync(file);
      toast.success(`Imported ${result.data.recordCount} records`);
      onSuccess();
    } catch {
      toast.error('Upload failed. Check that the file is a valid Apple Health export.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-border p-10 text-center transition-colors hover:border-primary"
    >
      <Upload className="h-8 w-8 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-medium">Drop your Apple Health export here</p>
        <p className="text-xs text-muted-foreground">
          Export from Health app → Profile → Export All Health Data → export.xml
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
      >
        {isPending ? 'Uploading…' : 'Browse file'}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
