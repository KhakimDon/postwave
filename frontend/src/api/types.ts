export type Platform = "telegram_bot" | "telegram_user" | "instagram";

export type PostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed";

export interface Account {
  id: number;
  platform: Platform;
  display_name: string;
  is_active: boolean;
  created_at: string;
}

export interface PostTarget {
  id: number;
  account_id: number;
  status: PostStatus;
  external_id: string | null;
  error: string | null;
  published_at: string | null;
}

export interface Post {
  id: number;
  content: string;
  media_urls: string[];
  scheduled_at: string | null;
  status: PostStatus;
  created_at: string;
  targets: PostTarget[];
}

export interface AccountCreate {
  platform: Platform;
  display_name: string;
  credentials: Record<string, string>;
}

export type IgPostType = "feed" | "carousel" | "reels" | "stories";

export interface TelegramOptions {
  silent?: boolean;
  no_preview?: boolean;
  parse_mode?: "MarkdownV2" | "HTML" | null;
}

export interface InstagramOptions {
  post_type?: IgPostType;
  location?: string;
  user_tags?: string[];
  collaborators?: string[];
  hide_likes?: boolean;
  disable_comments?: boolean;
  alt_text?: string;
  share_to_feed?: boolean;
}

export interface PlatformOptions {
  telegram?: TelegramOptions;
  instagram?: InstagramOptions;
}

export interface TgDialog {
  id: number;
  name: string;
  is_user: boolean;
  is_group: boolean;
  is_channel: boolean;
  unread: number;
  last_message: string;
  date: string | null;
}

export interface TgMessage {
  id: number;
  text: string;
  out: boolean;
  date: string | null;
  media_type: "photo" | "video" | "audio" | "sticker" | "document" | null;
}

export interface PostCreate {
  content: string;
  media_urls: string[];
  scheduled_at: string | null;
  account_ids: number[];
  platform_options?: PlatformOptions;
}
