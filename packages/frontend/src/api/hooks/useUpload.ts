import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiResponse } from '@vitals/shared';
import { apiFetch } from '../client';

interface UploadResult {
  importId: string;
  recordCount: number;
  status: string;
}

export function useUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiFetch<ApiResponse<UploadResult>>('/api/upload/apple-health', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition'] });
      queryClient.invalidateQueries({ queryKey: ['measurements'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
