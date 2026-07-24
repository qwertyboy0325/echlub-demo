import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MusicalDomainStore } from "../shell/domain/musicalDomain";
import { ShellStore } from "../shell/domain/shellStore";
import { createInitialShellState } from "../shell/domain/shellFixtures";
import { SHIKI_PUBLIC_PACK_ID, sha256Hex } from "./shikiPackIntegrity";

describe("shell musical integration", () => {
  const packJson = readFileSync(join(process.cwd(), "public/shiki-no-uta.demo.pack.json"), "utf8");

  it("loads public pack into musical domain without private material", () => {
    const domain = new MusicalDomainStore();
    const pack = domain.loadPackJson(packJson);
    expect(pack.metadata.id).toBe(SHIKI_PUBLIC_PACK_ID);
    expect(packJson).not.toContain("midi-only-private");
    expect(domain.workspaceDraft()?.notes?.length).toBeGreaterThan(0);
  });

  it("edits bump draft revision and fingerprint", () => {
    const domain = new MusicalDomainStore();
    domain.loadPackJson(packJson);
    const draftId = "midi-opening-bass";
    const noteId = domain.draftForId(draftId)?.notes?.[0]?.id;
    expect(noteId).toBeTruthy();
    const before = domain.draftForId(draftId)!.revision ?? 0;
    const result = domain.moveNoteStep(draftId, noteId!, 3);
    expect(result?.revision).toBeGreaterThan(before);
    expect(result?.fingerprint).toMatch(/^fp-[a-f0-9]+$/);
  });

  it("fork is non-destructive to source draft", () => {
    const domain = new MusicalDomainStore();
    domain.loadPackJson(packJson);
    const sourceId = "midi-opening-bass";
    const sourceRevision = domain.draftForId(sourceId)!.revision ?? 0;
    const forkId = "midi-opening-bass-fork-test";
    domain.forkDraft(sourceId, forkId, "pulse-r2");
    domain.moveNoteStep(forkId, domain.draftForId(forkId)!.notes![0]!.id, 5);
    expect(domain.draftForId(sourceId)!.revision).toBe(sourceRevision);
    expect(domain.draftForId(forkId)!.revision).toBeGreaterThan(sourceRevision);
  });

  it("activate maps draft kind to scene layer and hydrates canonical placements", () => {
    const domain = new MusicalDomainStore();
    domain.loadPackJson(packJson);
    domain.forkDraft("midi-opening-guitar", "midi-opening-guitar-fork", "guitar-r1");
    domain.activateSharedMaster("midi-opening-guitar-fork", 0);
    const scene = domain.getSession()!.scenes[0]!;
    expect(scene.layers.melody?.draftId).toBe("midi-opening-guitar-fork");
    expect(scene.layers.bass?.draftId).toBe("midi-opening-bass");
    expect(scene.layers.harmony?.draftId).toBe("midi-opening-piano-rh");
    expect(scene.layerStacks?.bass?.length).toBeGreaterThan(0);
    expect(domain.getSession()!.arrangement.scenes.length).toBeGreaterThan(1);
  });

  it("exchange lifecycle assigns draft ids through share and fork", () => {
    const store = new ShellStore(createInitialShellState());
    store.dispatch({ type: "SHARE_CLIP" });
    const shared = store.getState().exchangeClips[0]!;
    expect(shared.draftId).toBe("midi-opening-bass");
    store.dispatch({ type: "SELECT_PARTICIPANT", participantId: "p2" });
    store.dispatch({ type: "FORK_CLIP", clipId: shared.id });
    const fork = store.getState().exchangeClips.find((c) => c.forkOf === shared.id)!;
    expect(fork.draftId).toContain("fork");
    store.dispatch({ type: "SUBMIT_REVIEW", clipId: fork.id });
    store.dispatch({ type: "MARK_READY", clipId: fork.id });
    store.dispatch({ type: "STAGE_CLIP", clipId: fork.id, slotId: "s1" });
    store.dispatch({ type: "ACTIVATE_SLOT", slotId: "s1" });
    expect(store.getState().arrangementSlots[0]!.state).toBe("active");
    expect(store.getState().activeMasterDraftId).toBe(fork.draftId);
  });

  it("restart restores sparse shell state", () => {
    const store = new ShellStore(createInitialShellState());
    store.dispatch({ type: "SHARE_CLIP" });
    store.dispatch({ type: "RESTART_SESSION" });
    expect(store.getState().exchangeClips).toHaveLength(0);
    expect(store.getState().transportBar).toBe(0);
  });

  it("public pack sha256 matches preservation baseline", () => {
    expect(sha256Hex(packJson)).toBe("85fafb0a95d81f92e87e26a4941fbdd4dff783bc6c5d0743e1f6019cd7def7af");
  });
});
