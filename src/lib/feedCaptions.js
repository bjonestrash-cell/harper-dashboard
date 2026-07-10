// 35 Harper-voice caption ideas — chic, understated, no hashtags.
// The lightbox shows 5 at a time and rotates through the full set: each time
// a photo is opened (or "More ideas" is tapped) the next 5 appear, wrapping
// back around after all 35 have been shown.

export const CAPTIONS = [
  'Wear the good jewelry. Every day is the occasion.',
  'Quietly luxurious.',
  'The finishing touch.',
  'Effortless, on purpose.',
  'Made to be lived in.',
  'Less noise, more shine.',
  'Timeless, without trying.',
  'An heirloom in the making.',
  'Understated. Never underdressed.',
  'The kind of piece you never take off.',
  'Elegance is in the details.',
  'Worn today. Loved forever.',
  'Simple lines, lasting impressions.',
  'Gold that goes where you go.',
  'Because you don’t need a reason.',
  'Style that speaks softly.',
  'Layer it. Live in it.',
  'The piece that pulls it all together.',
  'Refined, not reserved.',
  'Designed for right now. Made to last.',
  'The art of the everyday.',
  'Polished, from morning to midnight.',
  'Luxury shouldn’t wait for a special occasion.',
  'Small details, big presence.',
  'Keep it classic.',
  'Your signature piece.',
  'Consider the outfit finished.',
  'Beauty in restraint.',
  'Everyday, elevated.',
  'Some things speak for themselves.',
  'A study in gold.',
  'Detail is everything.',
  'For the collector of beautiful things.',
  'Nothing extra. Everything essential.',
  'Luxury, made attainable.',
]

const ROTATION_KEY = 'harper-caption-rotation'

export function nextCaptions(count = 5) {
  let idx = parseInt(localStorage.getItem(ROTATION_KEY), 10)
  if (!Number.isFinite(idx) || idx < 0) idx = 0
  const out = []
  for (let i = 0; i < count; i++) {
    out.push(CAPTIONS[(idx + i) % CAPTIONS.length])
  }
  try {
    localStorage.setItem(ROTATION_KEY, String((idx + count) % CAPTIONS.length))
  } catch (e) {}
  return out
}
