import type { KanbanColumn } from "./api/types";

export const MIN_COLS = 2;
export const MAX_COLS = 8;

// Палитра для колонок (выбор в настройках)
export const COLUMN_COLORS = [
  "#868e96", // серый
  "#4dabf7", // синий
  "#9775fa", // фиолетовый
  "#38d9a9", // бирюзовый
  "#ffa94d", // оранжевый
  "#ff6b6b", // красный
  "#f783ac", // розовый
  "#ffd43b", // жёлтый
];

export function defaultColumns(t: (k: string) => string): KanbanColumn[] {
  return [
    { id: "all", title: t("inbox.colAll"), color: COLUMN_COLORS[0] },
    { id: "interested", title: t("inbox.colInterested"), color: COLUMN_COLORS[1] },
    { id: "ordering", title: t("inbox.colOrdering"), color: COLUMN_COLORS[4] },
    { id: "ordered", title: t("inbox.colOrdered"), color: COLUMN_COLORS[3] },
  ];
}

/** В какой колонке лежит чат: явная раскладка, иначе — первая колонка. */
export function columnIdOf(
  dialogId: number,
  columns: KanbanColumn[],
  placements: Record<string, string>,
): string | undefined {
  const c = placements[String(dialogId)];
  if (c && columns.some((x) => x.id === c)) return c;
  return columns[0]?.id;
}

/** Цвет колонки, в которой лежит чат (для метки в списке чатов). */
export function colorOf(
  dialogId: number,
  columns: KanbanColumn[],
  placements: Record<string, string>,
): string | undefined {
  const id = columnIdOf(dialogId, columns, placements);
  return columns.find((c) => c.id === id)?.color ?? undefined;
}
