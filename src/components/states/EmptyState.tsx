import type { ReactNode } from "react";
import { CircleDashed } from "lucide-react";

interface Props {
  title: string;
  body?: ReactNode;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

/** Empty state: says what is missing and what will fill it — direction, not mood (SH-05). */
export function EmptyState({ title, body, icon, actionLabel, onAction }: Props) {
  return (
    <div className="empty-state" role="status">
      <div className="empty-state__title">
        {icon ?? <CircleDashed size={16} aria-hidden="true" />}
        <span>{title}</span>
      </div>
      {body && <div className="empty-state__body">{body}</div>}
      {actionLabel && onAction && (
        <div className="empty-state__actions">
          <button type="button" className="text-btn text-btn--quiet" onClick={onAction}>
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
