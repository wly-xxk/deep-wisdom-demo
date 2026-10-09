import { useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { extractTextFromFile, getErrorDetail } from '@/lib/interview';

const ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp';
const MAX_BYTES = 20 * 1024 * 1024;

interface Props {
  kind: 'jd' | 'resume';
  onText: (text: string) => void;
}

export function FileUploadButton({ kind, onText }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const label = kind === 'jd' ? 'JD' : '简历';

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPT.split(',').includes(file.type)) {
      toast.error('仅支持 PDF 或图片（PNG / JPG / WebP）');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('文件需小于 20MB');
      return;
    }
    setBusy(true);
    try {
      const text = await extractTextFromFile(file, kind);
      onText(text);
      toast.success(`已从「${file.name}」识别出${label}文字，可直接编辑`);
    } catch (e) {
      toast.error(getErrorDetail(e));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        type="button"
        className="btn btn-secondary h-8"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {busy ? '识别中…' : `上传${label}（PDF/图片）`}
      </button>
    </>
  );
}
