import { Navigate, useLocation } from 'react-router-dom';
import type { PanelId } from '../../context/PanelContext';

/**
 * Old bookmarks/links pointed at full pages (`/pomodoro?taskId=...`) that are now slide-over
 * panels over the calendar (task 5.1). Preserves any existing query params (e.g. `taskId`)
 * instead of dropping them, since a static <Navigate to> can't carry the current search string.
 */
export function LegacyPanelRedirect({ panel }: { panel: PanelId }) {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set('panel', panel);

  return <Navigate to={`/calendar?${params.toString()}`} replace />;
}
