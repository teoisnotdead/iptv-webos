import { BRAND_COLOR, BRAND_NAME } from "../config";
import { cx } from "../lib/cx";
import styles from "./Brand.module.css";

/**
 * Logo de Lytra TV: la "Secuencia" de Lytra (tres cartas que llegan una tras otra, la más nueva al
 * frente) con un play calado en la carta del frente. Cada carta queda recortada por la siguiente,
 * agrandada 1.5. Se dibuja con el color de marca, así que un revendedor con otro color lo ve en el suyo.
 * scripts/appinfo.mjs dibuja el mismo símbolo en los íconos del TV: si cambia aquí, cambia allá.
 */
function markSvg(color: string): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs>' +
    '<mask id="b"><rect width="24" height="24" fill="#fff"/><rect x="5.5" y="4.2" width="12" height="15.6" rx="3"/></mask>' +
    '<mask id="m"><rect width="24" height="24" fill="#fff"/><rect x="9.5" y="7.9" width="12" height="15.6" rx="3"/></mask>' +
    '<mask id="f"><rect width="24" height="24" fill="#fff"/>' +
    '<path d="M14.55 13.55L14.55 17.85L18.05 15.7Z" stroke="#000" stroke-width="1.1" stroke-linejoin="round"/></mask>' +
    "</defs>" +
    `<rect x="3" y="2" width="9" height="12.6" rx="1.7" fill="${color}" opacity=".4" mask="url(#b)"/>` +
    `<rect x="7" y="5.7" width="9" height="12.6" rx="1.7" fill="${color}" opacity=".7" mask="url(#m)"/>` +
    `<rect x="11" y="9.4" width="9" height="12.6" rx="1.7" fill="${color}" mask="url(#f)"/>` +
    "</svg>"
  );
}

/** Como imagen y no en línea: los `id` de las máscaras no chocan aunque haya varios logos a la vez. */
const MARK_URI = "data:image/svg+xml," + encodeURIComponent(markSvg(BRAND_COLOR));

export function BrandMark({ class: className }: { class?: string }) {
  return <img class={cx(styles.mark, className)} src={MARK_URI} alt="" />;
}

/**
 * "Lytra", "Lytra TV", "Lytra Kids"…: la firma de Lytra con lo que siga como etiqueta. Otro nombre
 * (el de un revendedor) se escribe tal cual.
 */
const LYTRA = /^lytra(?:\s+(.+))?$/i.exec(BRAND_NAME);
const TAG = LYTRA && LYTRA[1] ? LYTRA[1].toUpperCase() : "";

/** `big`: más grande que el texto que la rodea (el título de la portada de Inicio). */
export function Wordmark({ class: className, big }: { class?: string; big?: boolean }) {
  const cls = cx(styles.wordmark, big && styles.big, className);
  if (!LYTRA) return <span class={cls}>{BRAND_NAME}</span>;
  return (
    <span class={cls} role="img" aria-label={BRAND_NAME}>
      <span class={styles.word}>
        lytr
        {/* La "a" de Lytra, dibujada: un anillo y un asta. */}
        <svg viewBox="0 -80 52 100" aria-hidden="true">
          <circle cx="24" cy="-26.5" r="21.25" fill="none" stroke="currentColor" stroke-width="10.5" />
          <rect x="41.5" y="-53" width="10.5" height="53" fill="currentColor" />
        </svg>
      </span>
      {TAG && <span class={styles.tag}>{TAG}</span>}
    </span>
  );
}
