/** Флаг «в композере есть несохранённые данные» — чтобы предупредить юзера при
 *  закрытии модалки или обновлении/закрытии вкладки. */
let dirty = false;

export const composerGuard = {
  setDirty(v: boolean) {
    dirty = v;
  },
  isDirty() {
    return dirty;
  },
};
