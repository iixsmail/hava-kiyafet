import { useSyncExternalStore } from "react";
import * as depo from "../storage/kalibrasyon";
import { ozet, aciklama } from "../logic/kalibrasyon";

/**
 * Kalibrasyon durumunu okuyan hook.
 *
 * `useSyncExternalStore`, modül düzeyindeki depoya abone oluyor; herhangi bir
 * ekrandan verilen geri bildirim diğer ekranları da anında güncelliyor.
 */
export function useKalibrasyon() {
  const durum = useSyncExternalStore(depo.abone, depo.anlik, depo.anlik);
  return {
    durum,
    ...ozet(durum),
    aciklama: aciklama(durum),
    geriBildir: depo.geriBildir,
    sifirla: depo.sifirla,
  };
}
