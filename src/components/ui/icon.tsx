import {
  Activity, AlertCircle, Archive, ArrowLeft, ArrowRight, ArrowUpRight, Bell, Building2, CalendarDays, Check, CheckCircle2,
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleDot, Clock, Copy, Database, Download, ExternalLink, Eye, File,
  FileText, Filter, Folder, FolderOpen, Globe, GripVertical, Hash, HardDrive, Inbox, Image as ImageIcon, Info, KeyRound,
  LayoutGrid, Link2, List, ListChecks, LoaderCircle, LogOut, Mail, MapPin, Menu, MessageSquare, Moon, MoreHorizontal,
  Paperclip, Pencil, Phone, Play, Plus, RefreshCw, Rows3, Search, Settings, Share2, Shield, SlidersHorizontal, Sparkles,
  Star, Sun, Tag, Trash2, TriangleAlert, Undo2, Upload, User, Users, X, Zap,
} from "lucide-react";
import { clsx } from "@/lib/clsx";

/** One curated set so every screen draws from the same alphabet. Add here, never inline an <svg>. */
export const icons = {
  activity: Activity, alert: AlertCircle, archive: Archive, "arrow-left": ArrowLeft, "arrow-right": ArrowRight,
  "arrow-up-right": ArrowUpRight, bell: Bell, board: LayoutGrid, calendar: CalendarDays, check: Check,
  "check-circle": CheckCircle2, "chevron-down": ChevronDown, "chevron-left": ChevronLeft, "chevron-right": ChevronRight,
  "chevron-up": ChevronUp, clock: Clock, copy: Copy, database: Database, dot: CircleDot, download: Download,
  external: ExternalLink, eye: Eye, file: File, filter: Filter, folder: Folder, "folder-open": FolderOpen, globe: Globe,
  grip: GripVertical, hash: Hash, image: ImageIcon, inbox: Inbox, info: Info, key: KeyRound, link: Link2, list: List,
  checklist: ListChecks, spinner: LoaderCircle, logout: LogOut, mail: Mail, menu: Menu, message: MessageSquare,
  moon: Moon, more: MoreHorizontal, paperclip: Paperclip, pencil: Pencil, phone: Phone, pin: MapPin, play: Play,
  plus: Plus, refresh: RefreshCw, rows: Rows3, search: Search, settings: Settings, share: Share2, shield: Shield,
  sliders: SlidersHorizontal, sparkles: Sparkles, star: Star, storage: HardDrive, sun: Sun, supplier: Building2,
  tag: Tag, text: FileText, trash: Trash2, undo: Undo2, upload: Upload, user: User, users: Users, warning: TriangleAlert,
  x: X, zap: Zap,
} as const;

export type IconName = keyof typeof icons;

export function Icon({ name, size = 16, className, strokeWidth = 1.75 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  const Cmp = icons[name];
  return <Cmp size={size} strokeWidth={strokeWidth} className={clsx("shrink-0", className)} aria-hidden focusable="false" />;
}

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { name: IconName; label: string; size?: number; tone?: "default" | "danger" };

/** Icon-only button with the accessible name and hit area handled for you. */
export function IconButton({ name, label, size = 16, tone = "default", className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        "inline-grid size-7 cursor-pointer place-items-center rounded-r transition-colors",
        tone === "danger" ? "text-ink-3 hover:bg-late-soft hover:text-late" : "text-ink-3 hover:bg-surface-2 hover:text-ink",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      <Icon name={name} size={size} />
    </button>
  );
}
