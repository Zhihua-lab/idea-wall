/** 表单/库里的 mood 值 → 图标与展示文案 */
const MOOD_ICONS: Record<string, string> = {
  happy: 'sentiment_very_satisfied',
  calm: 'self_improvement',
  excited: 'celebration',
  tired: 'bedtime',
  sad: 'sentiment_dissatisfied',
  anxious: 'psychology',
}

const MOOD_LABELS_ZH: Record<string, string> = {
  happy: 'Happy（充满阳光）',
  calm: 'Calm（如水宁静）',
  excited: 'Excited（心潮澎湃）',
  tired: 'Tired（需要小憩）',
  sad: 'Sad（淡淡忧伤）',
  anxious: 'Anxious（有点急躁）',
}

export function moodIconForStored(mood: string): string {
  if (MOOD_ICONS[mood]) return MOOD_ICONS[mood]
  return 'draw'
}

export function moodLineForDetail(mood: string): string {
  const label = MOOD_LABELS_ZH[mood] ?? mood
  return `今日心情：${label}`
}
