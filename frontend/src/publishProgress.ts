import { useSyncExternalStore } from "react";

/** Глобальный прогресс публикации поста — показывается плавающим блоком справа
 *  снизу. Прогресс плавно «едет» до 90% во время запроса, на успехе — 100%. */
export type PubPhase = "running" | "done" | "error";

export interface PubState {
  active: boolean;
  percent: number;
  phase: PubPhase;
  message: string;
}

let state: PubState = { active: false, percent: 0, phase: "running", message: "" };
const listeners = new Set<() => void>();

function emit() {
  state = { ...state };
  listeners.forEach((l) => l());
}

export function getPublish(): PubState {
  return state;
}
export function closePublish() {
  state.active = false;
  emit();
}

export function usePublish(): PubState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getPublish
  );
}

/** Запускает действие с прогресс-блоком: едем 0→90% во время запроса, 100% на успехе. */
export async function runPublish<T>(
  message: string,
  doneMsg: string,
  fn: () => Promise<T>
): Promise<T> {
  state = { active: true, percent: 6, phase: "running", message };
  emit();
  const iv = setInterval(() => {
    state.percent = Math.min(90, state.percent + Math.max(0.8, (90 - state.percent) * 0.07));
    emit();
  }, 220);

  try {
    const res = await fn();
    clearInterval(iv);
    state = { active: true, percent: 100, phase: "done", message: doneMsg };
    emit();
    setTimeout(() => {
      if (state.phase === "done") {
        state.active = false;
        emit();
      }
    }, 3500);
    return res;
  } catch (e) {
    clearInterval(iv);
    state = {
      active: true,
      percent: state.percent,
      phase: "error",
      message: (e as Error).message,
    };
    emit();
    throw e;
  }
}
