export function resolvePresenterMode(): boolean {
  const flag = import.meta.env.VITE_PRESENTER_MODE;
  if (flag === "true" || flag === "1") return true;
  if (typeof window !== "undefined") {
    const path = window.location.pathname.replace(/\/$/, "");
    return path.endsWith("/present");
  }
  return false;
}
