/**
 * The crawler a pet, mount or minion follows used to live on `companion.master` (pets) and `minion.caster`
 * (minions). Only an old link moves onto `master`: migrateData also runs on every partial update, and setting
 * master there would unlink a pet each time its sheet saved. Pure module.
 */
export function migrateMaster<T extends Record<string, any>>(source: T): T {
  const old = source?.companion?.master || source?.minion?.caster
  if (!source?.master && old) (source as any).master = old
  return source
}
