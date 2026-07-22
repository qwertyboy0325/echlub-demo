import type { JamMemory, PerformanceScriptEvent } from "./types";

export const performanceScript: PerformanceScriptEvent[] = [
  { id: "e01", at: "0:0:0", brain: "story", action: "thought", label: "Define the opening", detail: "Hold the full groove back. Let the listener enter through memory." },
  { id: "e02", at: "0:1:0", brain: "memory", action: "focus", target: "memory-opening", label: "Open phrase editor", detail: "Select the opening fragment draft." },
  { id: "e03", at: "0:2:0", brain: "memory", action: "edit", target: "memory-opening", label: "Shape four notes", detail: "Move the final note later and keep a large pocket of silence." },
  { id: "e04", at: "1:0:0", brain: "blend", action: "filter", target: "blend-filtered", value: 780, label: "Close the room", detail: "Low-pass the harmonic bed and leave the texture distant." },
  { id: "e05", at: "2:0:0", brain: "memory", action: "preview", target: "memory-opening", label: "Private cue", detail: "Audition the fragment without sending it to master." },
  { id: "e06", at: "3:0:0", brain: "memory", action: "ready", target: "memory-opening", label: "Draft ready", detail: "The opening fragment is now reusable by Story." },
  { id: "e07", at: "4:0:0", brain: "story", action: "queue", target: "story-opening", label: "Queue Opening Memory", detail: "Bind the fragment, soft harmony and air texture into Scene A." },
  { id: "e08", at: "6:0:0", brain: "story", action: "launch", target: "opening", label: "Launch Scene A", detail: "Commit the first scene to the master timeline." },

  { id: "e09", at: "8:0:0", brain: "pulse", action: "focus", target: "pulse-sparse", label: "Open sequencer", detail: "Build a sparse groove under the memory layer." },
  { id: "e10", at: "8:2:0", brain: "pulse", action: "edit", target: "pulse-sparse", label: "Place kick steps", detail: "Use four anchors and avoid filling every subdivision." },
  { id: "e11", at: "9:2:0", brain: "blend", action: "filter", target: "blend-warm", value: 1450, label: "Reveal low mids", detail: "Gradually make room for bass and harmony." },
  { id: "e12", at: "10:0:0", brain: "pulse", action: "preview", target: "pulse-sparse", label: "Preview groove", detail: "Listen against the active opening before offering it." },
  { id: "e13", at: "11:0:0", brain: "pulse", action: "offer", target: "pulse-sparse", label: "Offer sparse groove", detail: "Make the groove available to Story at the next phrase boundary." },
  { id: "e14", at: "12:0:0", brain: "story", action: "queue", target: "groove", label: "Queue Groove Established", detail: "Accept Pulse's draft and add the bass layer." },
  { id: "e15", at: "14:0:0", brain: "story", action: "launch", target: "groove", label: "Launch Scene B", detail: "The piece now has a stable forward motion." },

  { id: "e16", at: "16:0:0", brain: "memory", action: "focus", target: "memory-main", label: "Open main phrase", detail: "Prepare the recognisable phrase, but do not release it yet." },
  { id: "e17", at: "17:0:0", brain: "memory", action: "edit", target: "memory-response", label: "Cut response fragment", detail: "Copy the main contour and remove the obvious opening notes." },
  { id: "e18", at: "18:0:0", brain: "memory", action: "preview", target: "memory-response", label: "Private cue response", detail: "Test a shorter phrase against the established groove." },
  { id: "e19", at: "19:0:0", brain: "memory", action: "offer", target: "memory-response", label: "Offer tease", detail: "Send only the response fragment to Story." },
  { id: "e20", at: "20:0:0", brain: "blend", action: "delay", target: "blend-filtered", value: 0.3, label: "Arm echo tail", detail: "Let the fragment leave a recognisable trace after it ends." },
  { id: "e21", at: "21:0:0", brain: "story", action: "queue", target: "tease", label: "Queue Melody Tease", detail: "Hold the full phrase and commit the shorter response instead." },
  { id: "e22", at: "22:0:0", brain: "story", action: "launch", target: "tease", label: "Launch Scene C", detail: "The listener receives enough information to expect a later release." },

  { id: "e23", at: "24:0:0", brain: "pulse", action: "focus", target: "pulse-break", label: "Prepare a gap", detail: "Remove the first beat before the full phrase enters." },
  { id: "e24", at: "24:2:0", brain: "memory", action: "ready", target: "memory-main", label: "Main phrase ready", detail: "The complete melodic draft is now available." },
  { id: "e25", at: "25:0:0", brain: "blend", action: "filter", target: "blend-release", value: 3200, label: "Open the mix", detail: "Widen the spectral space while keeping the bass muted for one beat." },
  { id: "e26", at: "26:0:0", brain: "pulse", action: "offer", target: "pulse-break", label: "Offer one-beat break", detail: "Attach a timing condition to the phrase launch." },
  { id: "e27", at: "27:0:0", brain: "story", action: "queue", target: "release", label: "Queue Main Release", detail: "Combine the full phrase, timing gap and wide mix at Bar 28." },
  { id: "e28", at: "28:0:0", brain: "story", action: "launch", target: "release", label: "Launch Scene D", detail: "All four brain decisions resolve into one phrase boundary." },
  { id: "e29", at: "30:0:0", brain: "blend", action: "delay", target: "blend-release", value: 0.2, label: "Reduce echo", detail: "Keep the main phrase in front after its entrance." },

  { id: "e30", at: "32:0:0", brain: "story", action: "thought", label: "Avoid the expected repeat", detail: "Replace the full phrase with its response and thin the groove." },
  { id: "e31", at: "32:2:0", brain: "pulse", action: "queue", target: "pulse-sparse", label: "Queue sparse groove", detail: "Make the recomposition breathe." },
  { id: "e32", at: "33:0:0", brain: "memory", action: "queue", target: "memory-response", label: "Recall response fragment", detail: "Reuse the draft in a different structural role." },
  { id: "e33", at: "34:0:0", brain: "story", action: "launch", target: "recompose", label: "Launch Recomposition", detail: "The expected repeat becomes an alternate take." },
  { id: "e34", at: "35:0:0", brain: "blend", action: "delay", target: "blend-filtered", value: 0.44, label: "Push melody backward", detail: "Let the fragment become memory again." },

  { id: "e35", at: "36:0:0", brain: "memory", action: "queue", target: "memory-opening", label: "Recall opening fragment", detail: "Bring the first idea back as an ending signal." },
  { id: "e36", at: "36:2:0", brain: "pulse", action: "queue", target: "silence", label: "Remove drums", detail: "Leave the final four bars without a full beat." },
  { id: "e37", at: "37:0:0", brain: "blend", action: "filter", target: "blend-filtered", value: 920, label: "Close the room", detail: "Return to the distant spectral shape from the opening." },
  { id: "e38", at: "38:0:0", brain: "story", action: "launch", target: "return", label: "Commit ending", detail: "Resolve the piece by restoring its earliest memory." },
  { id: "e39", at: "39:2:0", brain: "story", action: "memory", target: "ending", label: "Capture final silence", detail: "Store the completed 40-bar arrangement in Jam Memory." },
];

export const jamMemories: JamMemory[] = [
  { id: "m1", at: "6:0:0", title: "First memory", description: "The opening fragment entered through a filtered room." },
  { id: "m2", at: "14:0:0", title: "Groove established", description: "Pulse and Blend created stable motion without exposing the full phrase." },
  { id: "m3", at: "22:0:0", title: "Melody teased", description: "A response fragment created recognition without full release." },
  { id: "m4", at: "28:0:0", title: "Main release", description: "A one-beat gap, full phrase and wider mix resolved together." },
  { id: "m5", at: "34:0:0", title: "Alternate take", description: "The expected repeat was replaced with a thinner recomposition." },
  { id: "m6", at: "38:0:0", title: "Return", description: "The opening memory returned as the ending." },
];
