import { Play } from "lucide-react";
import { resolveShellPackMode } from "../domain/liveCollabPack";
import {
  countPlayingLanes,
  isLaneLaunchableState,
  isLanePlayingState,
  laneStateLabel,
} from "../shell/laneSlotSemantics";
import type { ShellCommand, ShellState } from "../shell/domain/shellTypes";
import { projectLiveCollabTimelineClips } from "../shell/liveCollabArrangementProjection";
import { displayTransportBar } from "../shell/transportPlaybackHint";
import type { PresentationViewport } from "./presentationStateAdapter";
import styles from "./styles/globalRoom.module.css";

const BAR_WIDTH = 40;
const BAR_COUNT = 16;
const COMPACT_BAR_COUNT = 8;

const OWNER_META: Record<string, { color: string; initial: string }> = {
  Ryo: { color: "#f9a8d4", initial: "R" },
  Kai: { color: "#67e8f9", initial: "K" },
  Mei: { color: "#86efac", initial: "M" },
  Ren: { color: "#c4b5fd", initial: "R" },
};

interface GlobalPerformanceRoomProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
  viewport: PresentationViewport;
}

function stateBadgeClass(
  playing: boolean,
  state: string,
): string {
  if (playing) return styles.clipBadgePlaying;
  if (state === "loaded" || state === "staged") return styles.clipBadgeLoaded;
  if (state === "queued") return styles.clipBadgeQueued;
  return styles.clipBadge;
}

export function GlobalPerformanceRoom({ state, dispatch, viewport }: GlobalPerformanceRoomProps) {
  const compact = viewport === "compact";
  const barCount = compact ? COMPACT_BAR_COUNT : BAR_COUNT;
  const isLiveCollab = resolveShellPackMode() === "live-collab";
  const launchedCount = countPlayingLanes(state.arrangementSlots);
  const performing = state.sessionPhase === "performing";
  const timelineClips = isLiveCollab
    ? projectLiveCollabTimelineClips(state.arrangementSlots, state.arrangementTracks)
    : state.timelineClips;

  const clipForExchange = (id: string) => state.exchangeClips.find((c) => c.id === id);

  const masterReadout =
    launchedCount > 0
      ? `${launchedCount}/7 playing`
      : "sparse — launch a lane";

  return (
    <section className={`${styles.room}${compact ? ` ${styles.compact}` : ""}`} aria-label="Global Performance">
      <header className={styles.header}>
        <span className={`${styles.phaseBadge}${performing ? ` ${styles.phasePerforming}` : ""}`}>
          {performing ? "Performing" : "Building"}
        </span>
        <span className={styles.masterReadout}>Shared Master · {masterReadout}</span>
        <button
          type="button"
          className={styles.exchangeLink}
          onClick={() => dispatch({ type: "SET_EXCHANGE_OPEN", open: true })}
        >
          Open Exchange
        </button>
      </header>

      <div className={styles.surface}>
        <div className={styles.ruler}>
          <div className={styles.rulerSpacer} />
          <div className={styles.rulerBars}>
            {Array.from({ length: barCount }, (_, i) => (
              <span key={i} className={(i + 1) % 4 === 0 ? styles.rulerBarBoundary : styles.rulerBar}>
                {i + 1}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.lanes}>
          {state.arrangementTracks.map((track, index) => {
            const slot = state.arrangementSlots[index];
            if (!slot) return null;
            const owner = track.identity.split(" · ")[1] ?? "—";
            const ownerMeta = OWNER_META[owner];
            const playing = isLanePlayingState(slot.state);
            const canLaunch = !performing && isLaneLaunchableState(slot.state) && slot.state !== "queued";
            const stagedClip = slot.clipId ? clipForExchange(slot.clipId) : null;
            const canPromote =
              stagedClip?.lifecycle === "Ready" && stagedClip.forkOf && isLaneLaunchableState(slot.state);
            const trackClips = timelineClips.filter((tc) => tc.trackId === track.id);
            const scoreWidth = barCount * BAR_WIDTH;
            const stateLabel = laneStateLabel(slot.state, state.transportBar);

            return (
              <div
                key={track.id}
                className={playing ? styles.laneRowPlaying : styles.laneRow}
                data-slot-id={slot.id}
              >
                <div className={styles.laneMeta}>
                  {ownerMeta && (
                    <span
                      className={styles.provenance}
                      style={{ background: `${ownerMeta.color}33`, color: ownerMeta.color }}
                    >
                      {ownerMeta.initial}
                    </span>
                  )}
                  <span className={styles.trackName}>{track.name}</span>
                </div>

                <div className={styles.scoreLane}>
                  <div className={styles.scoreInner} style={{ width: scoreWidth }}>
                    {trackClips.map((tc) => {
                      const clip = clipForExchange(tc.exchangeClipId);
                      const variantClass =
                        tc.variant === "active"
                          ? styles.scoreClipActive
                          : tc.variant === "staged"
                            ? styles.scoreClipStaged
                            : styles.scoreClip;
                      return (
                        <div
                          key={tc.id}
                          className={variantClass}
                          style={{
                            left: (tc.startBar - 1) * BAR_WIDTH,
                            width: tc.lengthBars * BAR_WIDTH - 4,
                          }}
                        >
                          <span className={styles.clipLabel}>{clip?.title ?? slot.label}</span>
                          <span className={stateBadgeClass(playing, slot.state)}>{stateLabel}</span>
                          {canLaunch && (
                            <button
                              type="button"
                              className={styles.clipLaunch}
                              onClick={() => {
                                if (canPromote && stagedClip) {
                                  dispatch({ type: "PROMOTE_CLIP", clipId: stagedClip.id, slotId: slot.id });
                                  return;
                                }
                                dispatch({
                                  type: "LAUNCH_SLOT",
                                  slotId: slot.id,
                                  draftId: slot.materialId ?? undefined,
                                });
                              }}
                            >
                              <Play size={10} aria-hidden />
                              {canPromote ? "Promote" : "Launch"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {!trackClips.length && slot.label && (
                      <div className={styles.scoreClipEmpty}>
                        <span className={styles.clipLabel}>{slot.label}</span>
                        <span className={stateBadgeClass(playing, slot.state)}>{stateLabel}</span>
                      </div>
                    )}
                    <div
                      className={styles.playhead}
                      style={{
                        left:
                          (state.transportBar - 1) * BAR_WIDTH +
                          (state.transportBeat - 1) * (BAR_WIDTH / 4),
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <footer className={styles.masterFooter}>
          <span className={styles.masterLabel}>Shared Master</span>
          <div className={styles.masterMeter} aria-hidden>
            <div
              className={styles.masterMeterFill}
              style={{ width: `${(launchedCount / 7) * 100}%` }}
            />
          </div>
          <span className={styles.masterReadout}>
            {launchedCount}/7 · bar {displayTransportBar(state.transportBar)}
          </span>
        </footer>
      </div>
    </section>
  );
}
