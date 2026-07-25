import interact from "interactjs";
import { Play } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "react-aria-components";
import { resolveShellPackMode } from "../../domain/liveCollabPack";
import { LIVE_COLLAB_SLOT_TRACKS } from "../../domain/liveCollabSessionAdapter";
import type { ShellCommand, ShellState } from "../../shell/domain/shellTypes";
import { displayTransportBar } from "../../shell/transportPlaybackHint";

interface GlobalArrangementProps {
  state: ShellState;
  dispatch: (command: ShellCommand) => void;
}

const BAR_COUNT = 16;
const BAR_WIDTH = 48;

function activeLaneCount(state: ShellState): number {
  return state.arrangementSlots.filter((s) => s.state === "active").length;
}

export function GlobalArrangement({ state, dispatch }: GlobalArrangementProps) {
  const lanesRef = useRef<HTMLDivElement>(null);
  const isLiveCollab = resolveShellPackMode() === "live-collab";
  const selectedClip = state.selectedExchangeClipId
    ? state.exchangeClips.find((c) => c.id === state.selectedExchangeClipId)
    : null;
  const canStage = selectedClip?.lifecycle === "Ready";
  const activeSlot = state.arrangementSlots.find((s) => s.state === "active");
  const stagedSlot = state.arrangementSlots.find((s) => s.state === "staged");
  const launchedCount = activeLaneCount(state);

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
    ? launchedCount > 0
      ? `${launchedCount}/7 lanes on Shared Master`
      : "Shared Master sparse — Launch a lane to hear it"
    : activeSlot
      ? `${activeSlot.label} on Shared Master`
      : "Shared Master unassigned — stage a Ready clip, then Activate";

  return (
    <section className="global-arrangement" aria-label="Arrangement and launcher">
      <header className="arrangement-status-bar">
        <span className="arrangement-status-label">Arrangement</span>
        <span className="arrangement-status-readout tabular-nums">
          bar {displayTransportBar(state.transportBar)} · {masterReadout}
          {!isLiveCollab && stagedSlot ? ` · staged: ${stagedSlot.label}` : ""}
        </span>
      </header>

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
                {state.timelineClips
                  .filter((tc) => tc.trackId === track.id)
                  .map((tc) => {
                    const clip = clipForExchange(tc.exchangeClipId);
                    return (
                      <div
                        key={tc.id}
                        className={`timeline-clip timeline-clip--${tc.variant}`}
                        style={{ left: (tc.startBar - 1) * BAR_WIDTH, width: tc.lengthBars * BAR_WIDTH - 4 }}
                      >
                        <span className="timeline-clip-title">{clip?.title ?? tc.exchangeClipId}</span>
                        <span className="timeline-clip-rev tabular-nums">r{clip?.revision ?? 1}</span>
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

      {isLiveCollab ? (
        <div className="arrangement-launcher arrangement-launcher--live-collab">
          <span className="launcher-label">Shiki lanes · Launch</span>
          <div className="arrangement-launcher-lanes">
            {state.arrangementSlots.map((slot) => {
              const trackId = LIVE_COLLAB_SLOT_TRACKS[slot.id];
              const canLaunch = slot.state !== "active";
              return (
                <div
                  key={slot.id}
                  className={`lane-launch-slot lane-launch-slot--${slot.state}${state.transportPlaying && slot.state === "active" ? " lane-launch-slot--pulse" : ""}`}
                  data-slot-id={slot.id}
                  data-demo-target={`launch-slot-${slot.id}`}
                >
                  <div className="lane-launch-meta">
                    <strong>{slot.label}</strong>
                    <span className="lane-launch-track tabular-nums">{trackId?.replace("track-", "") ?? slot.id}</span>
                  </div>
                  <div className="lane-actions">
                    {slot.state === "active" ? (
                      <span className="active-badge">Active</span>
                    ) : slot.state === "staged" ? (
                      <Button
                        className="primary-btn lane-launch-btn"
                        onPress={() => dispatch({ type: "LAUNCH_SLOT", slotId: slot.id })}
                      >
                        <Play size={12} aria-hidden />
                        Launch
                      </Button>
                    ) : canLaunch ? (
                      <Button
                        className="primary-btn lane-launch-btn"
                        onPress={() => dispatch({ type: "LAUNCH_SLOT", slotId: slot.id })}
                      >
                        <Play size={12} aria-hidden />
                        Launch
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
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
      )}

      <div className="master-strip">
        <span className="master-label">Shared Master</span>
        <div className="master-assignment">
          {isLiveCollab ? (
            launchedCount > 0 ? (
              <>
                <strong>{launchedCount}/7 lanes</strong>
                <span className="tabular-nums">live-collab</span>
              </>
            ) : (
              <span className="master-empty">Sparse — Launch lanes to build the master</span>
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
  );
}
