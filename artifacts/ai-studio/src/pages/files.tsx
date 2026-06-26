import { useState, useRef } from "react";
import { useListFiles, useDeleteFile, useDownloadAsZip, getListFilesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload, Trash2, Archive, Download, FolderOpen, File, FileCode, Image, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function fileIcon(mimeType: string, name: string) {
  if (mimeType.startsWith("image/")) return <Image className="w-4 h-4 text-violet-400" />;
  if (mimeType.startsWith("video/")) return <Video className="w-4 h-4 text-cyan-400" />;
  if (name.match(/\.(zip|tar|gz|bz2|7z|rar|tgz)$/i)) return <Archive className="w-4 h-4 text-orange-400" />;
  if (name.match(/\.(ts|tsx|js|jsx|py|go|rs|java|cpp|c|html|css|json|yaml|yml|md)$/i)) return <FileCode className="w-4 h-4 text-emerald-400" />;
  return <File className="w-4 h-4 text-muted-foreground" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilesPage() {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [extracting, setExtracting] = useState<string | null>(null);
  const [extractedFiles, setExtractedFiles] = useState<{ id: string; files: string[]; downloadUrl: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: files, isLoading } = useListFiles();
  const deleteFile = useDeleteFile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFilesQueryKey() });
        toast({ title: "File deleted" });
      },
    },
  });
  const downloadZip = useDownloadAsZip({
    mutation: {
      onSuccess: (data) => {
        window.open(data.downloadUrl, "_blank");
        toast({ title: `ZIP ready: ${data.filename}` });
      },
      onError: () => toast({ title: "ZIP creation failed", variant: "destructive" }),
    },
  });

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/files/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      await queryClient.invalidateQueries({ queryKey: getListFilesQueryKey() });
      toast({ title: `Uploaded: ${file.name}` });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    for (const f of droppedFiles) await uploadFile(f);
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    for (const f of selected) await uploadFile(f);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const extractArchive = async (fileId: string) => {
    setExtracting(fileId);
    try {
      const res = await fetch("/api/files/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      const data = await res.json() as { success: boolean; files: string[]; downloadUrl: string };
      if (data.success) {
        setExtractedFiles({ id: fileId, files: data.files, downloadUrl: data.downloadUrl });
        toast({ title: `Extracted ${data.files.length} files` });
      }
    } catch {
      toast({ title: "Extraction failed", variant: "destructive" });
    } finally {
      setExtracting(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">File Manager</h1>
        <p className="text-muted-foreground text-sm mt-1">Upload, extract archives, and download as ZIP</p>
      </div>

      {/* Upload zone */}
      <div
        data-testid="upload-dropzone"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "mb-6 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all",
          dragOver ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-card/50"
        )}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">Drop files here or click to upload</p>
            <p className="text-xs text-muted-foreground">Photos, videos, ZIP, TAR, and more — up to 100MB</p>
          </div>
        )}
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput} data-testid="input-file-upload" />
      </div>

      {/* Actions bar */}
      {selectedIds.length > 0 && (
        <div className="mb-4 flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <span className="text-sm text-foreground font-medium">{selectedIds.length} selected</span>
          <Button
            size="sm"
            data-testid="button-download-zip"
            onClick={() => downloadZip.mutate({ data: { fileIds: selectedIds, zipName: null } })}
            disabled={downloadZip.isPending}
          >
            {downloadZip.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Download className="w-3.5 h-3.5 mr-1.5" /> Download as ZIP</>}
          </Button>
          <button onClick={() => setSelectedIds([])} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
        </div>
      )}

      {/* File list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : files && files.length > 0 ? (
        <div className="space-y-2">
          {files.map((file) => (
            <div key={file.id} data-testid={`file-row-${file.id}`}>
              <div className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-all",
                selectedIds.includes(file.id) ? "border-primary bg-primary/10" : "border-border bg-card hover:border-border/80"
              )}>
                <input
                  type="checkbox"
                  data-testid={`checkbox-file-${file.id}`}
                  checked={selectedIds.includes(file.id)}
                  onChange={() => toggleSelect(file.id)}
                  className="rounded border-border accent-primary"
                />
                {fileIcon(file.mimeType, file.originalName)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{file.originalName}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(file.size)} · {new Date(file.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {file.isArchive && (
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`button-extract-${file.id}`}
                      onClick={() => extractArchive(file.id)}
                      disabled={extracting === file.id}
                      className="h-7 text-xs"
                    >
                      {extracting === file.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Archive className="w-3 h-3 mr-1" /> Extract</>}
                    </Button>
                  )}
                  <a href={file.url} download data-testid={`button-download-file-${file.id}`} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button
                    data-testid={`button-delete-file-${file.id}`}
                    onClick={() => deleteFile.mutate({ id: file.id })}
                    className="p-1.5 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Extracted files panel */}
              {extractedFiles?.id === file.id && (
                <div data-testid={`extracted-panel-${file.id}`} className="ml-6 mt-1 p-3 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-foreground">{extractedFiles.files.length} extracted files</p>
                    <a href={extractedFiles.downloadUrl} download data-testid="button-download-extracted" className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Download className="w-3 h-3" /> Download all
                    </a>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {extractedFiles.files.map((f, i) => (
                      <p key={i} className="text-xs text-muted-foreground font-mono truncate">{f}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FolderOpen className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No files yet. Upload some above.</p>
        </div>
      )}
    </div>
  );
}
