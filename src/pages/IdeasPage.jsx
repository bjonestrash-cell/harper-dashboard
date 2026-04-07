import { useState, useCallback, useEffect, useRef } from 'react'
import PageHeader from '../components/PageHeader'
import './IdeasPage.css'

const BRAND_CONTEXT = `Harper Jewelry Co is a fine jewelry brand targeting women aged 25-45 who are style-conscious, gift-givers, and self-purchasers. They shop for engagement, anniversary, birthday, and milestone jewelry. The brand aesthetic is minimal, warm, editorial, and luxury. Primary platforms are Instagram and TikTok.`

const SYSTEM_PROMPT = `You are a social media strategist and content consultant for Harper Jewelry Co.

${BRAND_CONTEXT}

Today's date is ${new Date().toISOString().split('T')[0]}.

Use web search to find current social media trends, upcoming holidays, and cultural moments. Then generate content ideas specifically tailored to Harper Jewelry's brand.

Respond in EXACTLY this JSON format (no markdown, no code blocks, just raw JSON):
{
  "trending": [
    { "platform": "INSTAGRAM", "format": "Reel", "hook": "description of the trend and content idea", "score": 85, "whyNow": "Short trend insight" }
  ],
  "moments": [
    { "date": "May 11", "occasion": "Mother's Day", "angle": "jewelry-specific content angle", "timing": "Start posting 14 days before", "daysOut": 38, "format": "Carousel" }
  ],
  "pillars": [
    { "theme": "Theme Name", "why": "Why it resonates with Harper's audience", "ideas": ["Post idea 1", "Post idea 2", "Post idea 3"] }
  ]
}`

function cacheIdeas(ideas) {
  localStorage.setItem('harper-ideas-cache', JSON.stringify({
    date: new Date().toISOString().split('T')[0],
    ideas,
  }))
}

export default function IdeasPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchIdeas = useCallback(async (bustCache = false) => {
    if (bustCache) localStorage.removeItem('harper-ideas-cache')
    setLoading(true)
    setError(null)
    try {
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
      if (!apiKey || apiKey === 'your_key') {
        await new Promise(r => setTimeout(r, 2500))
        const mock = getMockData()
        setData(mock)
        cacheIdeas(mock)
        setLoading(false)
        return
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
          system: SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: 'Generate fresh content ideas for Harper Jewelry for the next 60 days. Search for current social media trends in fashion and luxury jewelry, and upcoming holidays/cultural moments. Return JSON only.'
          }],
        }),
      })

      if (!response.ok) throw new Error(`API error: ${response.status}`)

      const result = await response.json()
      const textBlock = result.content?.find(b => b.type === 'text')
      if (textBlock) {
        const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
        if (jsonMatch) { const p = JSON.parse(jsonMatch[0]); setData(p); cacheIdeas(p) }
        else throw new Error('Could not parse response')
      } else throw new Error('No text in response')
    } catch (err) {
      console.error('Ideas API error:', err)
      setError(err.message)
      setData(getMockData())
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-load: check for today's cached data, otherwise fetch fresh
  useEffect(() => {
    const todayKey = new Date().toISOString().split('T')[0]
    const cached = localStorage.getItem('harper-ideas-cache')
    if (cached) {
      try {
        const { date, ideas } = JSON.parse(cached)
        if (date === todayKey && ideas) {
          setData(ideas)
          return
        }
      } catch {}
    }
    fetchIdeas()
  }, [fetchIdeas])

  const platformColor = (p) => {
    const pl = p?.toLowerCase()
    if (pl === 'instagram') return { bg: 'var(--pink-light)', color: 'var(--pink-deep)' }
    if (pl === 'tiktok') return { bg: '#1a1a2e', color: '#fff' }
    if (pl === 'both') return { bg: 'var(--cream-mid)', color: 'var(--ink-mid)' }
    return { bg: 'var(--cream-mid)', color: 'var(--ink-mid)' }
  }

  const getUrgencyColor = (daysOut) => {
    if (daysOut <= 7) return '#C0392B'
    if (daysOut <= 21) return '#D4A017'
    return '#5C7A5C'
  }
  const getUrgencyLabel = (daysOut) => {
    if (daysOut <= 7) return 'POST NOW'
    if (daysOut <= 21) return 'START SOON'
    return 'PLAN AHEAD'
  }


  return (
    <div className="ideas-page">
      <PageHeader title="Ideas">
        <button onClick={() => fetchIdeas(true)} disabled={loading}
          style={{
            padding: '8px 24px', borderRadius: 9999, border: 'none',
            backgroundColor: loading ? 'var(--cream-mid)' : 'var(--ink)',
            color: loading ? 'var(--ink-light)' : 'var(--cream)',
            fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase',
            fontFamily: 'Inter, sans-serif', transition: 'all 0.2s ease',
            opacity: loading ? 0.5 : 1, pointerEvents: loading ? 'none' : 'auto',
          }}>
          {loading ? 'Refreshing...' : 'Refresh Ideas'}
        </button>
      </PageHeader>

      <div className="page-container">
        {loading && <IdeasLoadingState />}

        {!loading && error && !data && (
          <div className="ideas-empty">
            <p>Could not load ideas. Check your API key or try again.</p>
            <button onClick={fetchIdeas} style={{
              marginTop: 16, padding: '8px 24px', borderRadius: 9999, border: 'none',
              backgroundColor: 'var(--ink)', color: 'var(--cream)', fontSize: 10,
              fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase',
            }}>Retry</button>
          </div>
        )}

        {!loading && data && (
          <div className="ideas-content-fade-in">
            {/* TRENDING NOW */}
            <section className="ideas-section">
              <h2 className="ideas-section-title">Trending Now</h2>

              <div className="ideas-grid">
                {(data.trending || []).map((item, i) => (
                  <div key={i} className="idea-card">
                    <div className="idea-card-top">
                      <span className="idea-platform-pill" style={{ backgroundColor: platformColor(item.platform).bg, color: platformColor(item.platform).color }}>
                        {item.platform}
                      </span>
                      <span className="idea-format-pill">{item.format}</span>
                    </div>
                    <p className="idea-hook">{item.hook}</p>
                    {item.whyNow && (
                      <div className="idea-why-now">{item.whyNow}</div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* UPCOMING MOMENTS */}
            <section className="ideas-section">
              <h2 className="ideas-section-title">Upcoming Moments</h2>
              <div className="ideas-moments">
                {(data.moments || []).map((item, i) => {
                  const daysOut = item.daysOut || 30
                  return (
                    <div key={i} className="moment-row">
                      <div className="moment-left">
                        <span className="moment-date">{item.date}</span>
                        <span className="moment-urgency" style={{ color: getUrgencyColor(daysOut) }}>
                          {getUrgencyLabel(daysOut)}
                        </span>
                      </div>
                      <div className="moment-body">
                        <div className="moment-title-row">
                          <span className="moment-occasion">{item.occasion}</span>
                          {item.format && (
                            <span className="idea-format-pill" style={{ fontSize: 8 }}>{item.format}</span>
                          )}
                        </div>
                        <p className="moment-angle">{item.angle}</p>
                      </div>
                      <span className="moment-timing">{item.timing}</span>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* TIKTOK SHOP LIVE */}
            <TikTokShopLiveSection />

            {/* CONTENT PILLARS */}
            <section className="ideas-section">
              <h2 className="ideas-section-title">Content Pillars This Month</h2>
              <div className="ideas-pillars">
                {(data.pillars || []).map((pillar, i) => (
                  <div key={i} className="pillar-card">
                    <h3 className="pillar-theme">{pillar.theme}</h3>
                    <p className="pillar-why">{pillar.why}</p>
                    <ul className="pillar-ideas">
                      {(pillar.ideas || []).map((idea, j) => (
                        <li key={j}>{idea}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

const LIVE_TIMES = [
  { day: 'Mon', start: 17, end: 19, label: '5–7pm PST', heat: 0.65 },
  { day: 'Tue', start: 17, end: 19, label: '5–7pm PST', heat: 0.9 },
  { day: 'Wed', start: 18, end: 20, label: '6–8pm PST', heat: 0.82 },
  { day: 'Thu', start: 17, end: 19, label: '5–7pm PST', heat: 0.95 },
  { day: 'Fri', start: 19, end: 21, label: '7–9pm PST', heat: 0.72 },
  { day: 'Sat', start: 11, end: 13, label: '11a–1p PST', heat: 0.78 },
  { day: 'Sun', start: 12, end: 14, label: '12–2pm PST', heat: 0.88 },
]
const TL_START = 8
const TL_END = 23
const TL_HOURS = TL_END - TL_START

function TikTokShopLiveSection() {
  return (
    <section className="ideas-section">
      <h2 className="ideas-section-title">TikTok Shop Live</h2>
      <div className="tiktok-subsection">
        <h3 className="tiktok-sub-title">Best Times to Go Live</h3>
        <p style={{ fontSize: 12, fontWeight: 300, color: 'var(--ink-light)', marginBottom: 20, lineHeight: 1.5 }}>
          Peak windows for US women 18–34 shopping fashion and jewelry on TikTok Live
        </p>

        {/* Timeline header */}
        <div className="tts-timeline">
          <div className="tts-header-row">
            <div className="tts-day-label" />
            <div className="tts-track-header">
              {Array.from({ length: TL_HOURS + 1 }, (_, i) => {
                const h = TL_START + i
                const label = h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`
                return i % 2 === 0 ? (
                  <span key={i} className="tts-hour-mark" style={{ left: `${(i / TL_HOURS) * 100}%` }}>{label}</span>
                ) : null
              })}
            </div>
          </div>

          {/* Day rows */}
          {LIVE_TIMES.map((slot, i) => {
            const leftPct = ((slot.start - TL_START) / TL_HOURS) * 100
            const widthPct = ((slot.end - slot.start) / TL_HOURS) * 100
            return (
              <div key={i} className="tts-row">
                <div className="tts-day-label">{slot.day}</div>
                <div className="tts-track">
                  <div className="tts-block"
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      opacity: 0.4 + slot.heat * 0.6,
                    }}>
                    <span className="tts-block-label">{slot.label}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const LOADING_PHRASES = [
  'reading the room...',
  'consulting the algorithm...',
  'studying your aesthetic...',
  'pulling from the zeitgeist...',
  'asking what she would post...',
  'mining for moments...',
  'feeling the vibe shift...',
  'tapping into the feed...',
  'curating with intention...',
  'checking what\'s having a moment...',
  'sourcing from the it girls...',
  'tracking the cultural pulse...',
  'finding your next obsession...',
  'decoding what\'s trending...',
  'looking for the white space...',
  'thinking like an editor...',
  'reading between the reels...',
  'scanning for signal, not noise...',
  'finding what\'s worth posting...',
  'doing the research so you don\'t have to...',
]

function IdeasLoadingState() {
  const [phraseIdx, setPhraseIdx] = useState(() => Math.floor(Math.random() * LOADING_PHRASES.length))
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setPhraseIdx(prev => {
          let next
          do { next = Math.floor(Math.random() * LOADING_PHRASES.length) } while (next === prev)
          return next
        })
        setVisible(true)
      }, 300)
    }, 1500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="ideas-loading-container">
      <div className="ideas-loading-ring" />
      <span className="ideas-loading-text" style={{ opacity: visible ? 1 : 0 }}>
        {LOADING_PHRASES[phraseIdx]}
      </span>
    </div>
  )
}

const ALL_TRENDING = [
  { platform: 'INSTAGRAM', format: 'Carousel', hook: 'Ring stack styling guide — show 3 ways to stack Harper\'s signature bands from minimal to bold', score: 92, whyNow: 'Styling carousels up 34% engagement this month' },
  { platform: 'TIKTOK', format: 'Reel', hook: 'GRWM for date night featuring a jewelry close-up transition reveal', score: 88, whyNow: 'GRWM format trending +28% on TikTok' },
  { platform: 'BOTH', format: 'Reel', hook: '"Jewelry I\'d buy myself" trend — self-love angle with Harper\'s everyday pieces', score: 85, whyNow: 'Self-purchase content resonating with 25-35 demo' },
  { platform: 'INSTAGRAM', format: 'Static', hook: 'Flat-lay editorial with spring florals and gold pieces — warm tones, natural light', score: 78, whyNow: 'Spring editorial flat-lays peak engagement season' },
  { platform: 'TIKTOK', format: 'UGC', hook: 'Customer unboxing reactions — the velvet box moment', score: 82, whyNow: 'UGC unboxing content driving 3x saves vs branded' },
  { platform: 'BOTH', format: 'Carousel', hook: 'Jewelry care 101 — how to clean and store fine jewelry (educational + brand trust)', score: 74, whyNow: 'Educational content builds authority in luxury space' },
  { platform: 'INSTAGRAM', format: 'Reel', hook: '"Outfit to jewelry" reverse styling — start with the piece and build the look around it', score: 89, whyNow: 'Reverse styling format driving massive saves on IG' },
  { platform: 'TIKTOK', format: 'Reel', hook: 'Price reveal trend — show the piece first, ask followers to guess the price, then reveal', score: 87, whyNow: 'Price reveal videos averaging 2M+ views in jewelry niche' },
  { platform: 'INSTAGRAM', format: 'Carousel', hook: 'Dupe vs. real — position Harper\'s quality against fast fashion jewelry with side-by-side longevity comparison', score: 83, whyNow: 'Anti-dupe positioning resonating with quality-conscious buyers' },
  { platform: 'BOTH', format: 'Static', hook: 'Golden hour jewelry shoot — catch light on chains and stones for organic looking editorial', score: 80, whyNow: 'Natural light jewelry photography saves up 41%' },
  { platform: 'TIKTOK', format: 'Reel', hook: '"What my jewelry says about me" personality trend — style archetypes matched to Harper pieces', score: 86, whyNow: 'Personality-based content drives high comment engagement' },
  { platform: 'INSTAGRAM', format: 'Story', hook: 'This or That polls — let followers vote between two Harper pieces to drive product discovery', score: 76, whyNow: 'Interactive stories see 3x swipe-up rate vs. static' },
  { platform: 'BOTH', format: 'Reel', hook: 'Aesthetic morning routine — slow, luxurious ASMR of putting on jewelry before leaving the house', score: 84, whyNow: 'ASMR lifestyle reels up 55% watch time this quarter' },
  { platform: 'TIKTOK', format: 'UGC', hook: 'Reaction to wearing fine jewelry for the first time — gifting moment captured on camera', score: 90, whyNow: 'Emotional gifting content driving highest share rates' },
  { platform: 'INSTAGRAM', format: 'Carousel', hook: 'Jewelry for every budget — curate 3 tiers ($under $150 / $150–400 / $400+) using Harper\'s range', score: 77, whyNow: 'Budget breakdown posts drive saves across all income demos' },
]

function getMockData() {
  const shuffled = shuffleArray(ALL_TRENDING)
  return {
    trending: shuffled.slice(0, 6),
    moments: [
      { date: 'May 11', occasion: "Mother's Day", angle: 'Gift guide: "Pieces she\'ll never take off" — highlight sentimental everyday jewelry', timing: 'Start 14 days before', daysOut: 38, format: 'Carousel' },
      { date: 'May 25', occasion: 'Memorial Day Weekend', angle: 'Summer jewelry edit — waterproof pieces, vacation styling', timing: 'Start 7 days before', daysOut: 52, format: 'Reel' },
      { date: 'Jun 1', occasion: 'Pride Month', angle: 'Celebration of love — rainbow-inspired styling, couples jewelry', timing: 'Post on June 1', daysOut: 59, format: 'Static' },
      { date: 'Jun 8', occasion: 'Best Friends Day', angle: 'Matching jewelry sets, friendship pieces, tag-a-friend giveaway', timing: 'Start 5 days before', daysOut: 66, format: 'Carousel' },
      { date: 'Jun 15', occasion: "Father's Day", angle: 'Unexpected angle — jewelry gifts from daughters to mothers who raised them solo', timing: 'Start 10 days before', daysOut: 73, format: 'Reel' },
    ],
    pillars: [
      { theme: 'Self-Purchase Celebration', why: 'Women are increasingly buying fine jewelry for themselves as markers of personal milestones — promotions, breakups, birthdays', ideas: ['Post: "You don\'t need an occasion" campaign', 'Reel: milestone moments that deserve jewelry', 'Carousel: 5 pieces under $500 to treat yourself'] },
      { theme: 'Wedding Season Prep', why: 'Peak engagement and wedding season drives search for bridal jewelry, bridesmaid gifts, and guest accessories', ideas: ['Instagram guide: Bridal jewelry by neckline', 'TikTok: Getting ready with the bride', 'Carousel: Bridesmaid gift sets at every price point'] },
      { theme: 'Everyday Luxury', why: 'Harper\'s audience values pieces that elevate daily outfits — not reserved for special occasions', ideas: ['Reel: Same outfit, 3 jewelry styling levels', 'Static: Close-up detail shots of texture and craftsmanship', 'Story series: How Harper\'s team styles their daily stacks'] },
      { theme: 'Behind the Craft', why: 'Transparency and craftsmanship build trust with luxury consumers who want to know the story', ideas: ['Reel: Workshop footage of pieces being made', 'Carousel: From sketch to final piece', 'TikTok: Sound-on ASMR polishing and setting stones'] },
    ],
  }
}
