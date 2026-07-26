import { useEffect, useState } from "react";
import { getV3PresenterEvidence } from "./v3PresenterEvidence";
import styles from "../styles/presenterCaption.module.css";

interface V3CaptionStripProps {
  hidden?: boolean;
}

export function V3CaptionStrip({ hidden }: V3CaptionStripProps) {
  const [caption, setCaption] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setCaption(getV3PresenterEvidence().caption);
    tick();
    const id = window.setInterval(tick, 120);
    return () => window.clearInterval(id);
  }, []);

  if (hidden || !caption) {
    return <div className={styles.v3CaptionHidden} aria-hidden />;
  }

  return (
    <div className={styles.v3Caption} role="status" aria-live="polite">
      {caption}
    </div>
  );
}
