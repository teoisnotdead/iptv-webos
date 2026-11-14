import type { IconName } from "../ui/Icon";
import { Message } from "../ui/Status";

/** Secciones que todavía no están en esta versión. */
export function Soon({ icon, title }: { icon: IconName; title: string }) {
  return <Message icon={icon} title={title} text="Esta sección llega en la próxima versión de la app." />;
}
