import { useSyncExternalStore } from "react";

/** Сохранённые быстрые ответы («скрипты»). Хранятся локально; CRUD — в настройках
 *  инбокса, быстрая вставка — из чата. */
export interface Script {
  id: string;
  title: string;
  text: string;
}

const KEY = "pw_scripts";
const EVT = "pw-scripts-changed";

function readStorage(): Script[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// Кэш снапшота: useSyncExternalStore требует стабильную ссылку между рендерами.
let cache: Script[] = readStorage();

function commit(list: Script[]): void {
  cache = list;
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVT));
}

export function getScripts(): Script[] {
  return cache;
}

export function addScript(title: string, text: string): void {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  commit([...cache, { id, title: title.trim(), text: text.trim() }]);
}

export function removeScript(id: string): void {
  commit(cache.filter((s) => s.id !== id));
}

/** Реактивная подписка на список скриптов (для чата и настроек). */
export function useScripts(): Script[] {
  return useSyncExternalStore(
    (cb) => {
      const onChange = () => {
        cache = readStorage(); // подхватываем изменения из другой вкладки
        cb();
      };
      window.addEventListener(EVT, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(EVT, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    getScripts,
  );
}
