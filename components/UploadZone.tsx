'use client';

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

interface Preview {
  file: File;
  url: string;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function UploadZone({ onFilesSelected, maxFiles = 10, disabled = false }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previews, setPreviews] = useState<Preview[]>([]);

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  function handleFiles(fileList: FileList | File[]) {
    if (disabled) {
      return;
    }

    const incomingFiles = Array.from(fileList);
    const rejected = incomingFiles.filter((file) => !ALLOWED_TYPES.includes(file.type));
    const valid = incomingFiles.filter((file) => ALLOWED_TYPES.includes(file.type)).slice(0, maxFiles);

    if (rejected.length > 0) {
      alert('Only JPEG, PNG, and WEBP files are allowed.');
    }

    if (incomingFiles.length > maxFiles) {
      alert(`Only the first ${maxFiles} images will be used.`);
    }

    previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    const nextPreviews = valid.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPreviews(nextPreviews);
    onFilesSelected(valid);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      handleFiles(event.target.files);
    }
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          isDragging ? 'border-gray-900 bg-gray-50' : 'border-gray-300 bg-white'
        } ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-gray-500'}`}
        onClick={() => {
          if (!disabled) {
            inputRef.current?.click();
          }
        }}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !disabled) {
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) {
            setIsDragging(true);
          }
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          disabled={disabled}
          onChange={onInputChange}
        />
        <p className="text-lg font-semibold text-gray-900">Drop carousel screenshots here</p>
        <p className="mt-1 text-sm text-gray-600">or click to select files</p>
        <p className="mt-4 text-xs text-gray-400">JPEG, PNG, WEBP · Up to 10 slides · 5MB each</p>
      </div>

      {previews.length > 0 && (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
          {previews.map((preview) => (
            <div key={`${preview.file.name}-${preview.file.size}`} className="w-24 shrink-0">
              <img
                src={preview.url}
                alt={preview.file.name}
                className="h-24 w-24 rounded-lg border border-gray-200 object-cover"
              />
              <p className="mt-1 truncate text-xs text-gray-500">{preview.file.name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
