import type { Account, AccountCreate, Post, PostCreate } from "./types";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
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

export interface UploadResult {
  url: string;
  filename: string;
  content_type: string;
}

export const api = {
  // uploads
  uploadFile: async (file: File): Promise<UploadResult> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/uploads`, { method: "POST", body: form });
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
