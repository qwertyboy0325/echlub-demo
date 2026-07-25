import type { ShellState } from "../../shell/domain/shellTypes";

interface PresenterCaptionStripProps {
  state: ShellState;
  caption?: string | null;
  presenterMode?: boolean;
  walkthroughRunning?: boolean;
}

export function PresenterCaptionStrip({
  state,
  caption,
  presenterMode = false,
  walkthroughRunning = false,
}: PresenterCaptionStripProps) {
  if (!presenterMode || !walkthroughRunning) return null;
  const feed = state.activityFeed.slice(0, 4);
  if (!caption && feed.length === 0) return null;

  return (
    <aside className="presenter-caption-strip" aria-label="Presenter activity">
      {caption && (
        <div className="presenter-caption-head">
          <span className="presenter-caption-label">Now</span>
          <p className="presenter-caption-current">{caption}</p>
        </div>
      )}
      {feed.length > 0 && (
        <div className="presenter-activity-thread">
          <span className="presenter-caption-label">Thread</span>
          <ul className="presenter-activity-feed">
            {feed.map((entry, index) => (
              <li key={`${entry}-${index}`} className={index === 0 ? "presenter-activity-feed--latest" : undefined}>
                {entry}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
