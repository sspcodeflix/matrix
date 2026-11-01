import { useLocation } from 'react-router-dom';
import type { AiStage } from '../Acceptance/api';

/**
 * Link to a story's Acceptance workspace that records the current page as the return path,
 * like src/navigation.ts does for Review and Huddle.
 */
export function useStoryLink() {
  const { pathname, search } = useLocation();
  const from = pathname + search;
  return (storyId: string, stage?: AiStage) => {
    const q = new URLSearchParams();
    if (stage) q.set('stage', stage);
    q.set('from', from);
    return `/acceptance/stories/${encodeURIComponent(storyId)}?${q.toString()}`;
  };
}
