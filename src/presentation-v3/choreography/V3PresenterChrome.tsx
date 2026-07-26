import { shellStore } from "../../shell/domain/shellStore";
import {
  getV3RunnerState,
  restartV3PresentationDemo,
  runV3PresentationDemo,
  setV3RunnerPaused,
  stopV3Runner,
} from "./v3ChoreographyRunner";
import type { ShellChoreographyEngine } from "../../shell/choreographyEngine";
import styles from "../styles/presenterChrome.module.css";

interface V3PresenterChromeProps {
  engine: ShellChoreographyEngine | null;
  hidden?: boolean;
}

export function V3PresenterChrome({ engine, hidden }: V3PresenterChromeProps) {
  if (hidden) return null;
  const runnerState = getV3RunnerState();

  const run = () => {
    void runV3PresentationDemo({ engine, mode: "formal" });
  };

  const pause = () => {
    setV3RunnerPaused(runnerState !== "paused");
  };

  const stop = () => stopV3Runner();

  const restart = () => {
    void restartV3PresentationDemo(engine, "formal");
  };

  const resumeFollow = () => {
    shellStore.dispatch({ type: "RESUME_FOLLOW" });
  };

  const state = shellStore.getState();
  const followLabel = state.followActive && !state.followLocked ? "Follow on" : "Follow locked";

  return (
    <div className={styles.chrome} data-demo-target="presenter-chrome" aria-label="Presenter controls">
      <button type="button" className={styles.btn} data-demo-target="presenter-run" onClick={run}>
        Run Demo
      </button>
      <button type="button" className={styles.btn} data-demo-target="presenter-pause" onClick={pause}>
        {runnerState === "paused" ? "Resume" : "Pause"}
      </button>
      <button type="button" className={styles.btn} data-demo-target="presenter-stop" onClick={stop}>
        Stop
      </button>
      <button type="button" className={styles.btn} data-demo-target="presenter-restart" onClick={restart}>
        Restart Demo
      </button>
      <span className={styles.followChip}>{followLabel}</span>
      {state.followLocked && (
        <button
          type="button"
          className={styles.btnGhost}
          data-demo-target="presenter-resume-follow"
          onClick={resumeFollow}
        >
          Resume Follow
        </button>
      )}
    </div>
  );
}
