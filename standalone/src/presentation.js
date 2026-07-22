import { gsap } from "gsap";
const brainColors = {
    memory: "#67e8f9",
    pulse: "#f9a8d4",
    blend: "#86efac",
    story: "#c4b5fd",
};
export class PresentationEngine {
    cursors = new Map();
    initialize() {
        ["memory", "pulse", "blend", "story"].forEach((brain) => {
            const cursor = document.querySelector(`[data-cursor="${brain}"]`);
            if (cursor)
                this.cursors.set(brain, cursor);
        });
    }
    reset() {
        this.cursors.forEach((cursor) => {
            gsap.killTweensOf(cursor);
            gsap.set(cursor, { x: 18, y: 18, opacity: 0.2, scale: 0.85 });
        });
        document.querySelectorAll(".brain-window").forEach((element) => element.classList.remove("focused"));
    }
    playEvent(event) {
        const panel = document.querySelector(`[data-brain="${event.brain}"]`);
        const cursor = this.cursors.get(event.brain);
        if (!panel || !cursor)
            return;
        document.querySelectorAll(".brain-window").forEach((element) => element.classList.remove("focused"));
        panel.classList.add("focused");
        const target = event.target
            ? panel.querySelector(`[data-target="${event.target}"]`)
            : panel.querySelector(".brain-primary-target");
        const panelRect = panel.getBoundingClientRect();
        const targetRect = (target ?? panel).getBoundingClientRect();
        const x = targetRect.left - panelRect.left + Math.min(targetRect.width * 0.65, targetRect.width - 12);
        const y = targetRect.top - panelRect.top + Math.min(targetRect.height * 0.6, targetRect.height - 10);
        const timeline = gsap.timeline();
        timeline
            .to(cursor, { opacity: 1, scale: 1, duration: 0.15 })
            .to(cursor, { x, y, duration: 0.58, ease: "power2.inOut" })
            .to(cursor, { scale: 0.72, duration: 0.08 })
            .to(cursor, { scale: 1, duration: 0.13 });
        if (target) {
            timeline.to(target, {
                boxShadow: `0 0 0 2px ${brainColors[event.brain]}88, 0 12px 30px ${brainColors[event.brain]}18`,
                duration: 0.12,
            }, "-=0.2");
            timeline.to(target, { boxShadow: "none", duration: 0.5 }, "+=0.16");
        }
        gsap.fromTo(panel, { backgroundColor: `${brainColors[event.brain]}0d` }, { backgroundColor: "rgba(20,24,36,.97)", duration: 0.9 });
    }
    pulseScene(sceneId) {
        const card = document.querySelector(`[data-scene="${sceneId}"]`);
        if (!card)
            return;
        gsap.fromTo(card, { scale: 0.97 }, { scale: 1, duration: 0.5, ease: "back.out(2)" });
    }
    flashMaster() {
        gsap.fromTo(".master-stage", { boxShadow: "0 0 0 rgba(103,232,249,0)" }, { boxShadow: "0 0 56px rgba(103,232,249,.16)", duration: 0.3, yoyo: true, repeat: 1 });
    }
}
