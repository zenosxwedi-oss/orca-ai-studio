import { useState } from "react";
import { useGenerateImage, useListImages, useDeleteImage, getListImagesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, Download, Sparkles, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const SIZES = ["1024x1024", "1536x1024", "1024x1536"];
const STYLES = ["", "photorealistic", "digital art", "oil painting", "watercolor", "anime", "3D render", "sketch"];

export function ImagesPage() {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [style, setStyle] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: images, isLoading: loadingImages } = useListImages();
  const generateImage = useGenerateImage({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListImagesQueryKey() });
        setPrompt("");
        toast({ title: "Image generated!" });
      },
      onError: () => toast({ title: "Generation failed", variant: "destructive" }),
    },
  });
  const deleteImage = useDeleteImage({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListImagesQueryKey() }),
      onError: () => toast({ title: "Delete failed", variant: "destructive" }),
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    generateImage.mutate({ data: { prompt: prompt.trim(), size, style: style || null } });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Image Studio</h1>
        <p className="text-muted-foreground text-sm mt-1">Generate images using AI</p>
      </div>

      {/* Generator */}
      <div className="p-5 rounded-xl border border-border bg-card mb-8">
        <div className="space-y-4">
          <div>
            <Label htmlFor="img-prompt" className="text-sm font-medium text-foreground mb-1.5 block">Prompt</Label>
            <Textarea
              id="img-prompt"
              data-testid="input-image-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image you want to generate..."
              className="resize-none bg-background border-border focus:border-primary"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-foreground mb-1.5 block">Size</Label>
              <div className="flex gap-2">
                {SIZES.map((s) => (
                  <button
                    key={s}
                    data-testid={`size-${s}`}
                    onClick={() => setSize(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                      size === s ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="img-style" className="text-sm font-medium text-foreground mb-1.5 block">Style (optional)</Label>
              <select
                id="img-style"
                data-testid="select-image-style"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full bg-background border border-border text-foreground text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {STYLES.map((s) => <option key={s} value={s}>{s || "No specific style"}</option>)}
              </select>
            </div>
          </div>
          <Button
            data-testid="button-generate-image"
            onClick={handleGenerate}
            disabled={!prompt.trim() || generateImage.isPending}
            className="w-full"
          >
            {generateImage.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Generate Image</>
            )}
          </Button>
        </div>
      </div>

      {/* Gallery */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Generated Images</h2>
        {loadingImages ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : images && images.length > 0 ? (
          <div className="grid grid-cols-3 gap-4">
            {images.map((img) => (
              <div key={img.id} data-testid={`image-card-${img.id}`} className="group relative rounded-xl overflow-hidden border border-border bg-card aspect-square">
                <img src={img.url} alt={img.prompt} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                  <p className="text-white text-xs line-clamp-3">{img.prompt}</p>
                  <div className="flex gap-2 justify-end">
                    <button
                      data-testid={`button-download-image-${img.id}`}
                      onClick={() => {
                        const dlUrl = img.url.replace("/images/file/", "/images/download/");
                        const a = document.createElement("a");
                        a.href = dlUrl;
                        a.download = img.url.split("/").pop() ?? "image.jpg";
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }}
                      className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      data-testid={`button-delete-image-${img.id}`}
                      onClick={() => deleteImage.mutate({ id: img.id })}
                      className="p-1.5 rounded-lg bg-destructive/80 hover:bg-destructive text-white transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ImageIcon className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No images yet. Generate your first one above.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Textarea({ id, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { id?: string }) {
  return <textarea id={id} {...props} className={`w-full rounded-lg border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary ${props.className ?? ""}`} />;
}
