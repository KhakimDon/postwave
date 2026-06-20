import { createElement } from "react";
import { notifications } from "@mantine/notifications";
import { api } from "./api/client";

/** Уведомления инбокса: глобальные настройки (вкл/звук), mute по чату, звук и показ. */

const K_NOTIFY = "pw_notify_enabled";
const K_SOUND = "pw_notify_sound";
const K_MUTED = "pw_muted_dialogs";

export function notifyEnabled(): boolean {
  return localStorage.getItem(K_NOTIFY) !== "0"; // по умолчанию включено
}
export function setNotifyEnabled(v: boolean): void {
  localStorage.setItem(K_NOTIFY, v ? "1" : "0");
  if (v) ensureNotifyPermission();
}

export function soundEnabled(): boolean {
  return localStorage.getItem(K_SOUND) !== "0"; // по умолчанию включено
}
export function setSoundEnabled(v: boolean): void {
  localStorage.setItem(K_SOUND, v ? "1" : "0");
}

function mutedSet(): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(K_MUTED) || "[]"));
  } catch {
    return new Set();
  }
}
export function isMuted(accountId: number, dialogId: number): boolean {
  return mutedSet().has(`${accountId}:${dialogId}`);
}
export function setMuted(accountId: number, dialogId: number, muted: boolean): void {
  const s = mutedSet();
  const key = `${accountId}:${dialogId}`;
  if (muted) s.add(key);
  else s.delete(key);
  localStorage.setItem(K_MUTED, JSON.stringify([...s]));
}

// Короткий приятный «пинг» через Web Audio — без звукового файла.
let audioCtx: AudioContext | null = null;
export function playPing(): void {
  if (!soundEnabled()) return;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    audioCtx = audioCtx || new Ctor();
    const ctx = audioCtx;
    if (ctx.state === "suspended") ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    o.start();
    o.stop(ctx.currentTime + 0.32);
  } catch {
    /* аудио недоступно — молча игнорируем */
  }
}

export function ensureNotifyPermission(): void {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  } catch {
    /* ignore */
  }
}

/** Показать уведомление о новом сообщении (если включено и чат не заглушён). */
export function notifyMessage(opts: {
  accountId: number;
  dialogId: number;
  name: string;
  text: string;
  // Аватар уведомления. Не задан → берём Telegram-аватар по умолчанию.
  // null → без аватара (например, Instagram, где аватара нет).
  avatarUrl?: string | null;
}): void {
  if (!notifyEnabled()) return;
  if (isMuted(opts.accountId, opts.dialogId)) return;

  // undefined → Telegram (как раньше); строка/null → используем как есть
  const iconSrc =
    opts.avatarUrl !== undefined
      ? opts.avatarUrl
      : api.tgUserAvatarUrl(opts.accountId, opts.dialogId);

  playPing();
  notifications.show({
    title: opts.name || "Сообщение",
    message: createElement(
      "span",
      {
        style: {
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          wordBreak: "break-word",
        },
      },
      opts.text || "📎",
    ),
    color: "brand",
    autoClose: 4500,
    icon: iconSrc
      ? createElement("img", {
          src: iconSrc,
          style: {
            width: 28,
            height: 28,
            borderRadius: "50%",
            objectFit: "cover",
            display: "block",
          },
        })
      : undefined,
    styles: { icon: { background: "transparent", width: 28, height: 28 } },
  });

  // системный пуш, если вкладка не в фокусе и есть разрешение
  try {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted" &&
      document.hidden
    ) {
      new Notification(opts.name || "Telegram", { body: opts.text || "📎" });
    }
  } catch {
    /* ignore */
  }
}
