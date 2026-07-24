import { useEffect, useState } from "react";
import { viewportModeForSize, type ViewportMode } from "./domain/shellTypes";

export function useViewportMode(): ViewportMode {
  const [mode, setMode] = useState<ViewportMode>(() =>
    viewportModeForSize(window.innerWidth, window.innerHeight),
  );

  useEffect(() => {
    const onResize = () => setMode(viewportModeForSize(window.innerWidth, window.innerHeight));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return mode;
}
