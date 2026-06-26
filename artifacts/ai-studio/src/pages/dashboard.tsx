import { Link } from "wouter";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { ImageIcon, Video, FolderOpen, MessageSquare, Github, Loader2 } from "lucide-react";

export function DashboardPage() {
  const { data: stats, isLoading } = useGetDashboardStats();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Your AI creative workspace</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Images", value: stats?.totalImages ?? 0, icon: ImageIcon, color: "text-violet-400", href: "/images" },
          { label: "Videos", value: stats?.totalVideos ?? 0, icon: Video, color: "text-cyan-400", href: "/videos" },
          { label: "Files", value: stats?.totalFiles ?? 0, icon: FolderOpen, color: "text-emerald-400", href: "/files" },
        ].map(({ label, value, icon: Icon, color, href }) => (
          <Link
            key={label}
            href={href}
            data-testid={`stat-card-${label.toLowerCase()}`}
            className="block p-5 rounded-xl border border-border bg-card hover:border-primary/40 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{label}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-3xl font-bold text-foreground">{value}</p>
            )}
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: "/chat", icon: MessageSquare, label: "Start a Chat", desc: "Ask AI anything, get code", color: "bg-violet-500/10 border-violet-500/20 hover:border-violet-500/40" },
            { href: "/images", icon: ImageIcon, label: "Generate Image", desc: "Create images from text", color: "bg-cyan-500/10 border-cyan-500/20 hover:border-cyan-500/40" },
            { href: "/videos", icon: Video, label: "Create Video", desc: "Animated 30s or 60s video", color: "bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40" },
            { href: "/files", icon: FolderOpen, label: "Manage Files", desc: "Upload, extract, download ZIP", color: "bg-orange-500/10 border-orange-500/20 hover:border-orange-500/40" },
            { href: "/github", icon: Github, label: "Push to GitHub", desc: "Export files to a repository", color: "bg-pink-500/10 border-pink-500/20 hover:border-pink-500/40" },
          ].map(({ href, icon: Icon, label, desc, color }) => (
            <Link
              key={href}
              href={href}
              data-testid={`action-${label.toLowerCase().replace(/\s+/g, "-")}`}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${color}`}
            >
              <Icon className="w-5 h-5 text-foreground shrink-0" />
              <div>
                <p className="font-medium text-sm text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent images */}
      {stats?.recentImages && stats.recentImages.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent Images</h2>
          <div className="grid grid-cols-4 gap-3">
            {stats.recentImages.map((img) => (
              <div key={img.id} data-testid={`recent-image-${img.id}`} className="aspect-square rounded-lg overflow-hidden border border-border bg-card">
                <img src={img.url} alt={img.prompt} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent videos */}
      {stats?.recentVideos && stats.recentVideos.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent Videos</h2>
          <div className="space-y-2">
            {stats.recentVideos.map((vid) => (
              <div key={vid.id} data-testid={`recent-video-${vid.id}`} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                <Video className="w-4 h-4 text-cyan-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{vid.prompt}</p>
                  <p className="text-xs text-muted-foreground">{vid.duration}s</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
