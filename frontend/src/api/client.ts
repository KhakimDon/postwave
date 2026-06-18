import type {
  Account,
  AccountCreate,
  KanbanBoard,
  KanbanColumn,
  Post,
  PostCreate,
  TgDialog,
  TgMessage,
  TgProfile,
  TgStatus,
} from "./types";

const BASE = "/api";
const TOKEN_KEY = "postwave_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// Управляемый logout: вместо жёсткой перезагрузки страницы (теряется весь стейт)
// клиент дёргает обработчик, который ставит App в состояние «не авторизован».
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

function authHeaders(): Record<string, string> {
  const t = tokenStore.get();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init?.headers as Record<string, string>),
    },
  });
  if (res.status === 401 && !path.startsWith("/auth")) {
    // токен истёк/невалиден — разлогиниваем мягко (без перезагрузки страницы)
    tokenStore.clear();
    if (onUnauthorized) onUnauthorized();
    else window.location.reload();
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface AuthUser {
  id: number;
  phone: string | null;
  name: string | null;
}

export interface UploadResult {
  url: string;
  filename: string;
  content_type: string;
}

export const api = {
  // auth
  register: (phone: string, password: string, name?: string) =>
    request<{ token: string; user: AuthUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ phone, password, name }),
    }),
  login: (phone: string, password: string) =>
    request<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone, password }),
    }),
  me: () => request<AuthUser>("/auth/me"),

  // uploads
  uploadFile: async (file: File): Promise<UploadResult> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/uploads`, {
      method: "POST",
      body: form,
      headers: authHeaders(),
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        detail = (await res.json()).detail ?? detail;
      } catch {
        /* ignore */
      }
      throw new Error(detail);
    }
    return res.json();
  },

  // accounts
  listAccounts: () => request<Account[]>("/accounts"),
  connectAccount: (data: AccountCreate) =>
    request<Account>("/accounts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteAccount: (id: number) =>
    request<void>(`/accounts/${id}`, { method: "DELETE" }),
  telegramBotInfo: () =>
    request<{ username: string; configured: boolean }>("/accounts/telegram-bot"),

  // CRM-инбокс (MTProto, свой аккаунт)
  tgUserStatus: () =>
    request<{ configured: boolean }>("/telegram/user/status"),
  tgUserLoginStart: (phone: string) =>
    request<{ login_id: string }>("/telegram/user/login/start", {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),
  tgUserLoginCode: (login_id: string, code: string) =>
    request<{ status: string; account?: Account }>("/telegram/user/login/code", {
      method: "POST",
      body: JSON.stringify({ login_id, code }),
    }),
  tgUserLoginPassword: (login_id: string, password: string) =>
    request<{ status: string; account?: Account }>(
      "/telegram/user/login/password",
      { method: "POST", body: JSON.stringify({ login_id, password }) }
    ),
  tgUserDialogs: (accountId: number, limit = 50, offset = 0) =>
    request<TgDialog[]>(
      `/telegram/user/${accountId}/dialogs?limit=${limit}&offset=${offset}`
    ),
  tgUserAvatarUrl: (accountId: number, dialogId: number) =>
    `/api/telegram/user/${accountId}/avatar/${dialogId}?token=${
      tokenStore.get() ?? ""
    }`,
  tgUserStreamUrl: (accountId: number) =>
    `/api/telegram/user/${accountId}/stream?token=${tokenStore.get() ?? ""}`,
  tgUserPresence: (accountId: number, dialogId: number) =>
    request<TgStatus>(`/telegram/user/${accountId}/dialogs/${dialogId}/status`),
  tgUserProfile: (accountId: number, dialogId: number) =>
    request<TgProfile>(`/telegram/user/${accountId}/profile/${dialogId}`),
  tgUserProfilePhotoUrl: (accountId: number, dialogId: number, index: number) =>
    `/api/telegram/user/${accountId}/profile/${dialogId}/photo/${index}?token=${
      tokenStore.get() ?? ""
    }`,
  tgUserMessages: (accountId: number, dialogId: number) =>
    request<TgMessage[]>(`/telegram/user/${accountId}/dialogs/${dialogId}/messages`),
  tgUserSend: (
    accountId: number,
    dialogId: number,
    text: string,
    mediaUrl?: string
  ) =>
    request<{ id: number }>(
      `/telegram/user/${accountId}/dialogs/${dialogId}/send`,
      {
        method: "POST",
        body: JSON.stringify({ text, media_url: mediaUrl ?? null }),
      }
    ),
  tgUserMediaUrl: (accountId: number, dialogId: number, msgId: number) =>
    `/api/telegram/user/${accountId}/media/${dialogId}/${msgId}?token=${
      tokenStore.get() ?? ""
    }`,
  // CRM-канбан (доска инбокса, общая для всех устройств)
  kanbanGet: (accountId: number) =>
    request<KanbanBoard>(`/kanban/${accountId}`),
  kanbanSetColumns: (accountId: number, columns: KanbanColumn[]) =>
    request<KanbanBoard>(`/kanban/${accountId}/columns`, {
      method: "PUT",
      body: JSON.stringify({ columns }),
    }),
  kanbanSetPlacement: (
    accountId: number,
    dialogId: string,
    columnId: string
  ) =>
    request<KanbanBoard>(`/kanban/${accountId}/placement`, {
      method: "PUT",
      body: JSON.stringify({ dialog_id: dialogId, column_id: columnId }),
    }),
  kanbanBroadcast: (
    accountId: number,
    columnId: string,
    text: string,
    mediaUrls: string[] = [],
  ) =>
    request<{ sent: number; failed: number; total: number }>(
      `/kanban/${accountId}/broadcast`,
      {
        method: "POST",
        body: JSON.stringify({
          column_id: columnId,
          text,
          media_urls: mediaUrls,
        }),
      },
    ),

  instagramOAuthStart: () =>
    request<{ url: string }>("/instagram/oauth/start"),
  instagramOAuthExchange: (code: string) =>
    request<{ status: string; username: string }>(
      `/instagram/oauth/exchange?code=${encodeURIComponent(code)}`
    ),

  // posts
  listPosts: () => request<Post[]>("/posts"),
  createPost: (data: PostCreate) =>
    request<Post>("/posts", { method: "POST", body: JSON.stringify(data) }),
  updatePost: (id: number, data: { scheduled_at?: string; content?: string }) =>
    request<Post>(`/posts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  publishNow: (id: number) =>
    request<Post>(`/posts/${id}/publish-now`, { method: "POST" }),
  deletePost: (id: number) =>
    request<void>(`/posts/${id}`, { method: "DELETE" }),
};
