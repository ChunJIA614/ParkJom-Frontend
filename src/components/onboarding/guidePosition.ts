/** Position the coachmark using viewport coordinates, independent of animations. */
export function getGuideCardPosition(
  viewportWidth: number,
  viewportHeight: number,
  target: { top: number; left: number; width: number; height: number; source: 'sidebar' | 'bottomnav' | 'none' },
  measuredHeight: number,
) {
  const margin = Math.min(16, viewportWidth / 4, viewportHeight / 4);
  const width = Math.min(336, viewportWidth - margin * 2);
  const availableAbove = target.source === 'bottomnav' ? target.top - margin * 2 : viewportHeight;
  const maxHeight = Math.max(0, Math.min(viewportHeight - margin * 2, availableAbove));
  const height = Math.min(measuredHeight, maxHeight);
  let left = (viewportWidth - width) / 2;
  let top = (viewportHeight - height) / 2;
  if (target.source === 'bottomnav') top = target.top - height - margin;
  if (target.source === 'sidebar') {
    top = target.top;
    left = target.left + target.width + margin;
    if (left + width > viewportWidth - margin) left = target.left - width - margin;
  }
  return {
    top: Math.max(margin, Math.min(top, viewportHeight - height - margin)),
    left: Math.max(margin, Math.min(left, viewportWidth - width - margin)),
    width,
    maxHeight,
  };
}
