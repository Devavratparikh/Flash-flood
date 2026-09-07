export function minutesAgo(date) {
  return Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000));
}

export function relativeTime(date) {
  const mins = minutesAgo(date);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
}
