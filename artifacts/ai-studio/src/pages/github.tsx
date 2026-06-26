import { useState } from "react";
import { useSaveToGithub, useListFiles } from "@workspace/api-client-react";
import { Loader2, Github, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export function GithubPage() {
  const [token, setToken] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [message, setMessage] = useState("Upload via Orca AI Studio");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [result, setResult] = useState<{ success: boolean; url: string; message: string } | null>(null);
  const { toast } = useToast();

  const { data: files, isLoading: loadingFiles } = useListFiles();
  const saveToGithub = useSaveToGithub({
    mutation: {
      onSuccess: (data) => {
        setResult(data);
        toast({ title: data.success ? "Pushed to GitHub!" : "Some files failed" });
      },
      onError: () => toast({ title: "GitHub push failed", variant: "destructive" }),
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const selectAll = () => setSelectedIds(files?.map((f) => f.id) ?? []);
  const clearAll = () => setSelectedIds([]);

  const handlePush = () => {
    if (!token || !repo || selectedIds.length === 0) return;
    setResult(null);
    saveToGithub.mutate({ data: { token, repo, branch: branch || null, message: message || null, fileIds: selectedIds } });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">GitHub Export</h1>
        <p className="text-muted-foreground text-sm mt-1">Push your files directly to a GitHub repository</p>
      </div>

      {/* Config */}
      <div className="p-5 rounded-xl border border-border bg-card mb-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Repository Settings</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label htmlFor="gh-token" className="text-sm font-medium text-foreground mb-1.5 block">GitHub Personal Access Token</Label>
            <Input
              id="gh-token"
              data-testid="input-github-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_..."
              className="bg-background border-border font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">Needs <code className="bg-muted px-1 rounded">repo</code> scope. Get one at <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">github.com/settings/tokens</a></p>
          </div>
          <div>
            <Label htmlFor="gh-repo" className="text-sm font-medium text-foreground mb-1.5 block">Repository (owner/repo)</Label>
            <Input
              id="gh-repo"
              data-testid="input-github-repo"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="username/my-repo"
              className="bg-background border-border"
            />
          </div>
          <div>
            <Label htmlFor="gh-branch" className="text-sm font-medium text-foreground mb-1.5 block">Branch</Label>
            <Input
              id="gh-branch"
              data-testid="input-github-branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              className="bg-background border-border"
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="gh-message" className="text-sm font-medium text-foreground mb-1.5 block">Commit Message</Label>
            <Input
              id="gh-message"
              data-testid="input-github-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Upload via Orca AI Studio"
              className="bg-background border-border"
            />
          </div>
        </div>
      </div>

      {/* File selector */}
      <div className="p-5 rounded-xl border border-border bg-card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Select Files to Push</h2>
          <div className="flex gap-2 text-xs">
            <button onClick={selectAll} data-testid="button-select-all" className="text-primary hover:underline">Select all</button>
            <span className="text-muted-foreground">·</span>
            <button onClick={clearAll} data-testid="button-clear-all" className="text-muted-foreground hover:text-foreground">Clear</button>
          </div>
        </div>
        {loadingFiles ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : files && files.length > 0 ? (
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {files.map((file) => (
              <label
                key={file.id}
                data-testid={`label-file-${file.id}`}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  data-testid={`checkbox-github-${file.id}`}
                  checked={selectedIds.includes(file.id)}
                  onChange={() => toggleSelect(file.id)}
                  className="rounded border-border accent-primary"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{file.originalName}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No files uploaded yet. Go to File Manager to upload files.</p>
        )}
      </div>

      {/* Push button */}
      <Button
        data-testid="button-push-github"
        onClick={handlePush}
        disabled={!token || !repo || selectedIds.length === 0 || saveToGithub.isPending}
        className="w-full"
      >
        {saveToGithub.isPending ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Pushing to GitHub...</>
        ) : (
          <><Github className="w-4 h-4 mr-2" /> Push {selectedIds.length} file{selectedIds.length !== 1 ? "s" : ""} to GitHub</>
        )}
      </Button>

      {/* Result */}
      {result && (
        <div data-testid="github-result" className={`mt-4 p-4 rounded-xl border flex items-start gap-3 ${result.success ? "border-emerald-500/30 bg-emerald-500/10" : "border-destructive/30 bg-destructive/10"}`}>
          {result.success ? <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />}
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{result.message}</p>
            {result.success && (
              <a href={result.url} target="_blank" rel="noopener noreferrer" data-testid="link-github-repo" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                View repository <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
