import { setAudioLanguage } from "../data/prefs";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { selectAudio, type AudioTrackInfo } from "./player";
import { trackLabel } from "./tracks";
import styles from "./AudioPicker.module.css";

/** Elegir la pista de audio. El idioma elegido se recuerda para los próximos videos. */
export function AudioPicker({ tracks, onClose }: { tracks: AudioTrackInfo[]; onClose: () => void }) {
  return (
    <Dialog title="Audio" onClose={onClose} actions={<Button onClick={onClose}>Cerrar</Button>}>
      <div class={styles.list}>
        {tracks.map((t) => (
          <Button
            key={t.index}
            icon={t.enabled ? "check" : undefined}
            selected={t.enabled}
            autofocus={t.enabled}
            class={styles.track}
            onClick={() => {
              selectAudio(t.index);
              if (t.language) setAudioLanguage(t.language);
              onClose();
            }}
          >
            {trackLabel(t)}
          </Button>
        ))}
      </div>
    </Dialog>
  );
}
