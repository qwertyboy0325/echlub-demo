import interact from "interactjs";
import { Play } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { resolveShellPackMode } from "../../domain/liveCollabPack";
import {
  countPlayingLanes,
  isLaneLaunchableState,
  isLanePlayingState,
  laneStateLabel,
} from "../../shell/laneSlotSemantics";
import type { ShellCommand, ShellState } from "../../shell/domain/shellTypes";
import { projectLiveCollabTimelineClips } from "../../shell/liveCollabArrangementProjection";
import { displayTransportBar } from "../../shell/transportPlaybackHint";

interface GlobalArrangementProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
}

const BAR_COUNT = 16;
const BAR_WIDTH = 48;

const LIVE_COLLAB_OWNER_META: Record<string, { color: string; initial: string; desk: string }> = {
  Ryo: { color: "var(--participant-ryo)", initial: "R", desk: "Rhythm Desk" },
  Kai: { color: "var(--participant-kai)", initial: "K", desk: "Keys Desk" },
  Mei: { color: "var(--participant-mei)", initial: "M", desk: "Horns Desk" },
  Ren: { color: "var(--participant-ren)", initial: "R", desk: "Guitar Desk" },
};

export function GlobalArrangement({ state, dispatch }: GlobalArrangementProps) {
  const lanesRef = useRef<HTMLDivElement>(null);
  const isLiveCollab = resolveShellPackMode() === "live-collab";
  const [timelineOpen, setTimelineOpen] = useState(isLiveCollab);
  const selectedClip = state.selectedExchangeClipId
    ? state.exchangeClips.find((c) => c.id === state.selectedExchangeClipId)
    : null;
  const canStage = selectedClip?.lifecycle === "Ready";
  const activeSlot = state.arrangementSlots.find((s) => s.state === "active");
  const stagedSlot = state.arrangementSlots.find((s) => s.state === "staged");
  const launchedCount = isLiveCollab ? countPlayingLanes(state.arrangementSlots) : countPlayingLanes(state.arrangementSlots);
  const queuedSlot = state.arrangementSlots.find((s) => s.state === "queued");
  const performing = state.sessionPhase === "performing";
  const timelineClips = isLiveCollab
    ? projectLiveCollabTimelineClips(state.arrangementSlots, state.arrangementTracks)
    : state.timelineClips;
  const allLanesLive = isLiveCollab && launchedCount >= 7;
  const masterPayoff = isLiveCollab && (allLanesLive || performing);

  useEffect(() => {
    if (isLiveCollab) return;
    const root = lanesRef.current;
    if (!root) return;
    const cleanups: Array<() => void> = [];
    root.querySelectorAll<HTMLElement>(".arrangement-drop-target[data-drop-ready='true']").forEach((lane) => {
      const slotId = lane.dataset.slotId;
      if (!slotId) return;
      const instance = interact(lane).dropzone({
        accept: ".exchange-row--draggable",
        overlap: 0.35,
        ondragenter: () => lane.classList.add("arrangement-drop-target--hover"),
        ondragleave: () => lane.classList.remove("arrangement-drop-target--hover"),
        ondrop: (event) => {
          lane.classList.remove("arrangement-drop-target--hover");
          const clipId = event.relatedTarget.getAttribute("data-clip-id");
          if (clipId) dispatch({ type: "STAGE_CLIP", clipId, slotId });
        },
      });
      cleanups.push(() => instance.unset());
    });
    return () => cleanups.forEach((c) => c());
  }, [dispatch, isLiveCollab, state.arrangementSlots, canStage]);

  const clipForExchange = (exchangeClipId: string) => state.exchangeClips.find((c) => c.id === exchangeClipId);

  const masterReadout = isLiveCollab
    ? allLanesLive
      ? "Shared song · all lanes live"
      : launchedCount > 0
        ? `Shared Master · ${launchedCount}/7 playing`
        : queuedSlot
          ? `${queuedSlot.label} queued for bar ${displayTransportBar(state.transportBar + 1)}`
          : "Shared Master · sparse — Launch a loaded lane to hear it"
    : activeSlot
      ? `${activeSlot.label} on Shared Master`
      : "Shared Master unassigned — stage a Ready clip, then Activate";

  const slotForTrackIndex = (index: number) => state.arrangementSlots[index];

  return (
    <section className={`global-arrangement${isLiveCollab ? " global-arrangement--split" : ""}`} aria-label="Arrangement and launcher">
      {isLiveCollab ? (
        <section className="global-zone global-zone--session" data-global-zone="session" aria-label="Shared master lanes">
          <header className="global-zone-header">
            <span className="global-zone-label">Shared lanes</span>
            <span
              className={`session-phase-badge session-phase-badge--${state.sessionPhase}`}
              data-demo-target="session-phase-badge"
            >
              {state.sessionPhase === "performing" ? "Performing Shared Song" : "Building Shared Song"}
            </span>
            <span className="global-zone-readout tabular-nums">bar {displayTransportBar(state.transportBar)}</span>
          </header>
          <div className="session-lane-table" aria-label="Shiki session lanes">
          <div className="session-lane-header" aria-hidden="true">
            <span />
            <span>Track</span>
            <span>Clip</span>
            <span>State</span>
            <span>Launch</span>
          </div>
          {state.arrangementTracks.map((track, index) => {
            const slot = slotForTrackIndex(index);
            if (!slot) return null;
            const owner = track.identity.split(" · ")[1] ?? "—";
            const ownerMeta = LIVE_COLLAB_OWNER_META[owner];
            const canLaunch = !performing && isLaneLaunchableState(slot.state) && slot.state !== "queued";
            const status = laneStateLabel(slot.state, state.transportBar);
            const stagedClip = slot.clipId ? clipForExchange(slot.clipId) : null;
            const lineageParent = stagedClip?.forkOf ? clipForExchange(stagedClip.forkOf) : null;
            const showLineage = Boolean(lineageParent && stagedClip);
            const canPromote =
              stagedClip?.lifecycle === "Ready" && stagedClip.forkOf && isLaneLaunchableState(slot.state);
            return (
              <div
                key={track.id}
                className={`session-lane-row session-lane-row--${slot.state}${isLanePlayingState(slot.state) && state.transportPlaying ? " session-lane-row--pulse" : ""}`}
                data-slot-id={slot.id}
                data-demo-target={`launch-slot-${slot.id}`}
                style={
                  ownerMeta
                    ? ({ "--lane-provenance": ownerMeta.color } as CSSProperties)
                    : undefined
                }
              >
                <div className="session-lane-provenance" aria-hidden={!ownerMeta}>
                  {ownerMeta ? (
                    <>
                      <span className="session-lane-provenance-initial">{ownerMeta.initial}</span>
                      <span className="session-lane-provenance-desk">{ownerMeta.desk}</span>
                    </>
                  ) : null}
                </div>
                <div className="session-lane-track">
                  <strong>{track.name}</strong>
                  <span className="session-lane-owner">{owner}</span>
                </div>
                <div className="session-lane-clip tabular-nums">
                  <span className="session-lane-clip-name">{slot.label}</span>
                  {showLineage && lineageParent ? (
                    <span className="session-lane-lineage" data-demo-target={`lane-lineage-${slot.id}`}>
                      {stagedClip?.draftId ?? stagedClip?.title} ← {lineageParent.draftId ?? lineageParent.title}
                    </span>
                  ) : null}
                  {slot.materialId && slot.materialId !== slot.label ? (
                    <span className="session-lane-material">{slot.materialId}</span>
                  ) : null}
                </div>
                <div className={`session-lane-state session-lane-state--${slot.state}`}>{status}</div>
                <div className="session-lane-actions lane-actions">
                  {isLanePlayingState(slot.state) ? (
                    <span className="active-badge">Playing</span>
                  ) : slot.state === "queued" ? (
                    <span className="queued-badge">Queued</span>
                  ) : canLaunch ? (
                    <>
                      {canPromote && stagedClip ? (
                        <Button
                          className="promote-btn"
                          data-demo-target={`promote-clip-${stagedClip.id}`}
                          onPress={() => dispatch({ type: "PROMOTE_CLIP", clipId: stagedClip.id, slotId: slot.id })}
                        >
                          Promote
                        </Button>
                      ) : null}
                      <Button
                        className="primary-btn lane-launch-btn"
                        onPress={() => dispatch({ type: "LAUNCH_SLOT", slotId: slot.id, draftId: slot.materialId ?? undefined })}
                      >
                        <Play size={12} aria-hidden />
                        Launch
                      </Button>
                    </>
                  ) : performing && isLaneLaunchableState(slot.state) ? (
                    <span className="performing-badge">Performing</span>
                  ) : (
                    <span className="lane-empty-badge">No clip</span>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </section>
      ) : (
        <header className="arrangement-status-bar">
          <span className="arrangement-status-label">Session</span>
          <span className="arrangement-status-readout tabular-nums">
            bar {displayTransportBar(state.transportBar)} · {masterReadout}
            {stagedSlot ? ` · staged: ${stagedSlot.label}` : ""}
          </span>
        </header>
      )}

      <section
        className={`global-zone global-zone--arrangement${allLanesLive ? " global-zone--arrangement-combined" : ""}`}
        data-global-zone="arrangement"
        data-demo-target="arrangement-score-map"
        aria-label={isLiveCollab ? "Arrangement score map" : "Arrangement timeline"}
      >
        {isLiveCollab ? (
          <header className="global-zone-header">
            <span className="global-zone-label">Arrangement</span>
            <span className="global-zone-hint">
              {allLanesLive ? "Shared song · all lanes live" : "score map"}
            </span>
          </header>
        ) : null}
        <details
          className="arrangement-timeline-details"
          open={timelineOpen}
          onToggle={(event) => setTimelineOpen((event.target as HTMLDetailsElement).open)}
        >
          <summary className="arrangement-timeline-summary">
            {isLiveCollab ? "Score map" : "Arrangement timeline"}
          </summary>
        <div className="arrangement-timeline">
          <div className="arrangement-ruler" aria-hidden="true">
            <div className="arrangement-ruler-spacer" />
            <div className="arrangement-ruler-bars" style={{ width: BAR_COUNT * BAR_WIDTH }}>
              {Array.from({ length: BAR_COUNT }, (_, i) => (
                <span key={i} className={`ruler-bar${(i + 1) % 4 === 0 ? " ruler-bar--boundary" : ""}`}>
                  {i + 1}
                </span>
              ))}
            </div>
          </div>

          <div className="arrangement-tracks" ref={lanesRef}>
            {state.arrangementTracks.map((track) => (
              <div key={track.id} className="arrangement-track-row">
                <div className="track-header">
                  <strong>{track.name}</strong>
                  <span>{track.identity}</span>
                </div>
                <div className="track-lane" style={{ width: BAR_COUNT * BAR_WIDTH }}>
                  {timelineClips
                    .filter((tc) => tc.trackId === track.id)
                    .map((tc) => {
                      const clip = clipForExchange(tc.exchangeClipId);
                      const title = clip?.title ?? clip?.draftId ?? tc.exchangeClipId;
                      return (
                        <div
                          key={tc.id}
                          className={`timeline-clip timeline-clip--${tc.variant}`}
                          style={{ left: (tc.startBar - 1) * BAR_WIDTH, width: tc.lengthBars * BAR_WIDTH - 4 }}
                        >
                          <span className="timeline-clip-title">{title}</span>
                          {!isLiveCollab ? (
                            <span className="timeline-clip-rev tabular-nums">r{clip?.revision ?? 1}</span>
                          ) : null}
                        </div>
                      );
                    })}
                  <div
                    className="playhead arrangement-playhead"
                    style={{ left: (state.transportBar - 1) * BAR_WIDTH + (state.transportBeat - 1) * (BAR_WIDTH / 4) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        </details>
      </section>

      {!isLiveCollab ? (
        <div className="arrangement-launcher">
          <span className="launcher-label">Shared Master slots</span>
          <div className="arrangement-launcher-slots">
            {state.arrangementSlots.map((slot, index) => {
              const firstEmpty = state.arrangementSlots.findIndex((s) => s.state === "empty");
              const showStage = canStage && slot.state === "empty" && selectedClip && index === firstEmpty;
              return (
                <div
                  key={slot.id}
                  className={`arrangement-drop-target arrangement-drop-target--${slot.state}`}
                  data-slot-id={slot.id}
                  data-drop-ready={slot.state === "empty" && canStage ? "true" : "false"}
                >
                  <span className="slot-label">{slot.state === "empty" ? "Drop Ready clip" : slot.label}</span>
                  <div className="lane-actions">
                    {showStage && (
                      <button
                        type="button"
                        className="stage-btn"
                        data-demo-target={`stage-clip-${slot.id}`}
                        onClick={() => dispatch({ type: "STAGE_CLIP", clipId: selectedClip.id, slotId: slot.id })}
                      >
                        Stage {selectedClip.title}
                      </button>
                    )}
                    {slot.state === "staged" && (
                      <Button className="primary-btn" onPress={() => dispatch({ type: "ACTIVATE_SLOT", slotId: slot.id })}>
                        Activate
                      </Button>
                    )}
                    {slot.state === "active" && <span className="active-badge">Active on Shared Master</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <section className={`global-zone global-zone--master${masterPayoff ? " global-zone--master-payoff" : ""}`} data-global-zone="master" aria-label="Shared Master readout">
        <header className="global-zone-header">
          <span className="global-zone-label">Shared Master</span>
          {isLiveCollab ? (
            <span className="global-zone-readout tabular-nums">{masterReadout}</span>
          ) : null}
        </header>
        <div className={`master-strip${masterPayoff ? " master-strip--payoff" : ""}`}>
          <div className="master-assignment">
            {isLiveCollab ? (
              launchedCount > 0 ? (
                <>
                  <strong>{launchedCount}/7 lanes playing</strong>
                  <span className="tabular-nums">live-collab</span>
                </>
              ) : (
                <span className="master-empty">Sparse — Launch loaded lanes to build the master</span>
              )
            ) : activeSlot ? (
              <>
                <strong>{activeSlot.label}</strong>
                <span className="tabular-nums">r{clipForExchange(activeSlot.clipId ?? "")?.revision ?? "—"}</span>
              </>
            ) : (
              <span className="master-empty">Unassigned — Play is silent until Activate</span>
            )}
          </div>
          <div className={`master-meter${launchedCount > 0 ? " master-meter--lit" : ""}`} aria-hidden="true">
            <span
              className="master-meter-fill"
              style={isLiveCollab ? { width: `${(launchedCount / 7) * 100}%` } : undefined}
            />
          </div>
        </div>
      </section>
    </section>
  );
}
