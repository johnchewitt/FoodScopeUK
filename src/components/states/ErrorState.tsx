import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  title: string;
  body?: ReactNode;
  details?: string[];
  actionLabel?: string;
  onAction?: () => void;
}

/** Error state: states what failed and how to recover, in the interface's voice (SH-05). */
export function ErrorState({ title, body, details, actionLabel, onAction }: Props) {
  return (
    <div className="error-state" role="alert">
      <div className="error-state__title">
        <TriangleAlert size={16} aria-hidden="true" />
        <span>{title}</span>
      </div>
      {body && <div className="error-state__body">{body}</div>}
      {details && details.length > 0 && (
        <ul className="error-state__body">
          {details.slice(0, 5).map((d) => (
            <li key={d}>
              <code>{d}</code>
            </li>
          ))}
        </ul>
      )}
      {actionLabel && onAction && (
        <div className="error-state__actions">
          <button type="button" className="text-btn" onClick={onAction}>
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
