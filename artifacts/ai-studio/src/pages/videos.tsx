import { useState } from "react";
import { useGenerateVideo, useListVideos, getListVideosQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Video, Play, Download, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STYLES = ["", "abstract particles", "neon cyberpunk", "nature landscape", "galaxy space", "ocean waves", "fire flames", "geometric shapes", "glitch art", "aurora borealis"];

export function VideosPage() {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(30);
  const [style, setStyle] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: videos, isLoading: loadingVideos } = useListVideos();
  const generateVideo = useGenerateVideo({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListVideosQueryKey() });
        setPreviewId(data.id);
        setPrompt("");
        toast({ title: "Video created!" });
      },
      onError: () => toast({ title: "Generation failed", variant: "destructive" }),
    },
  });

  const previewVideo = videos?.find((v) => v.id === previewId) ?? (videos && videos.length > 0 && !previewId ? videos[0] : null);

  const downloadHtml = (htmlCode: string, id: string) => {
    const blob = new Blob([htmlCode], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `video-${id}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Video Studio</h1>
        <p className="text-muted-foreground text-sm mt-1">Create animated HTML5 canvas videos (30s or 60s)</p>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Generator */}
        <div className="col-span-2">
          <div className="p-5 rounded-xl border border-border bg-card space-y-4">
            <div>
              <Label className="text-sm font-medium text-foreground mb-1.5 block">Prompt</Label>
              <textarea
                data-testid="input-video-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your video animation..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                rows={4}
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-foreground mb-1.5 block">Duration</Label>
              <div className="flex gap-2">
                {[30, 60].map((d) => (
                  <button
                    key={d}
                    data-testid={`duration-${d}`}
                    onClick={() => setDuration(d)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                      duration === d ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-foreground mb-1.5 block">Style (optional)</Label>
              <select
                data-testid="select-video-style"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full bg-background border border-border text-foreground text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {STYLES.map((s) => <option key={s} value={s}>{s || "No specific style"}</option>)}
              </select>
            </div>
            <Button
              data-testid="button-generate-video"
              onClick={() => generateVideo.mutate({ data: { prompt: prompt.trim(), duration, style: style || null } })}
              disabled={!prompt.trim() || generateVideo.isPending}
              className="w-full"
            >
              {generateVideo.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Clapperboard className="w-4 h-4 mr-2" /> Create Video</>
              )}
            </Button>
          </div>

          {/* Video list */}
          {loadingVideos ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : videos && videos.length > 0 ? (
            <div className="mt-4 space-y-2">
              {videos.map((vid) => (
                <button
                  key={vid.id}
                  data-testid={`video-item-${vid.id}`}
                  onClick={() => setPreviewId(vid.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                    previewId === vid.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <Video className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{vid.prompt}</p>
                    <p className="text-xs text-muted-foreground">{vid.duration}s</p>
                  </div>
                  <Play className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Preview */}
        <div className="col-span-3">
          {previewVideo ? (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">{previewVideo.prompt}</p>
                  <p className="text-xs text-muted-foreground">{previewVideo.duration}s animation</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  data-testid="button-download-html"
                  onClick={() => downloadHtml(previewVideo.htmlCode, previewVideo.id)}
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Download HTML
                </Button>
              </div>
              <iframe
                key={previewVideo.id}
                srcDoc={previewVideo.htmlCode}
                sandbox="allow-scripts"
                className="w-full"
                style={{ height: "420px" }}
                title="Video Preview"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-dashed border-border text-center">
              <Video className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground text-sm">Generate a video to preview it here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
