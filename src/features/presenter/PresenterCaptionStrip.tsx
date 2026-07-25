import type { ShellState } from "../../shell/domain/shellTypes";

interface PresenterCaptionStripProps {
  state: ShellState;
  caption?: string | null;
}

export function PresenterCaptionStrip({ state, caption }: PresenterCaptionStripProps) {
  const feed = state.activityFeed.slice(0, 4);
  if (!caption && feed.length === 0) return null;

  return (
    <aside className="presenter-caption-strip" aria-label="Presenter activity">
      {caption && <p className="presenter-caption-current">{caption}</p>}
      {feed.length > 0 && (
        <ul className="presenter-activity-feed">
          {feed.map((entry, index) => (
            <li key={`${entry}-${index}`}>{entry}</li>
          ))}
        </ul>
      )}
    </aside>
  );
}
