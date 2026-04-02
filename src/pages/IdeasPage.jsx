import { useState, useCallback } from 'react'
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
    { "platform": "INSTAGRAM", "format": "Reel", "hook": "description of the trend and content idea" }
  ],
  "moments": [
    { "date": "May 11", "occasion": "Mother's Day", "angle": "jewelry-specific content angle", "timing": "Start posting 14 days before" }
  ],
  "pillars": [
    { "theme": "Theme Name", "why": "Why it resonates with Harper's audience", "ideas": ["Post idea 1", "Post idea 2", "Post idea 3"] }
  ]
}`

export default function IdeasPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchIdeas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
      if (!apiKey || apiKey === 'your_key') {
        // Generate mock data if no API key
        setData(getMockData())
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

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const result = await response.json()
      const textBlock = result.content?.find(b => b.type === 'text')
      if (textBlock) {
        // Extract JSON from response (may be wrapped in markdown)
        let jsonStr = textBlock.text
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          setData(parsed)
        } else {
          throw new Error('Could not parse response')
        }
      } else {
        throw new Error('No text in response')
      }
    } catch (err) {
      console.error('Ideas API error:', err)
      setError(err.message)
      // Fall back to mock data on error
      setData(getMockData())
    } finally {
      setLoading(false)
    }
  }, [])

  // Load on first render
  useState(() => { fetchIdeas() })

  const platformColor = (p) => {
    const pl = p?.toLowerCase()
    if (pl === 'instagram') return { bg: 'var(--pink-light)', color: 'var(--pink-deep)' }
    if (pl === 'tiktok') return { bg: '#1a1a2e', color: '#fff' }
    if (pl === 'both') return { bg: 'var(--cream-mid)', color: 'var(--ink-mid)' }
    return { bg: 'var(--cream-mid)', color: 'var(--ink-mid)' }
  }

  return (
    <div className="ideas-page">
      <PageHeader title="Ideas">
        <button onClick={fetchIdeas} disabled={loading}
          style={{
            padding: '8px 24px', borderRadius: 9999, border: 'none',
            backgroundColor: loading ? 'var(--cream-mid)' : 'var(--ink)',
            color: loading ? 'var(--ink-light)' : 'var(--cream)',
            fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase',
            fontFamily: 'Inter, sans-serif', transition: 'all 0.2s ease',
          }}>
          {loading ? 'Generating...' : 'Refresh Ideas'}
        </button>
      </PageHeader>

      <div className="page-container">
        {loading && !data && (
          <div className="ideas-loading">
            <div className="ideas-loading-dot" />
            <span>Generating ideas for Harper Jewelry...</span>
          </div>
        )}

        {error && !data && (
          <div className="ideas-empty">
            <p>Could not load ideas. Check your API key or try again.</p>
            <button onClick={fetchIdeas} style={{
              marginTop: 16, padding: '8px 24px', borderRadius: 9999, border: 'none',
              backgroundColor: 'var(--ink)', color: 'var(--cream)', fontSize: 10,
              fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase',
            }}>Retry</button>
          </div>
        )}

        {data && (
          <>
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
                  </div>
                ))}
              </div>
            </section>

            {/* UPCOMING MOMENTS */}
            <section className="ideas-section">
              <h2 className="ideas-section-title">Upcoming Moments</h2>
              <div className="ideas-moments">
                {(data.moments || []).map((item, i) => (
                  <div key={i} className="moment-row">
                    <span className="moment-date">{item.date}</span>
                    <div className="moment-body">
                      <span className="moment-occasion">{item.occasion}</span>
                      <p className="moment-angle">{item.angle}</p>
                    </div>
                    <span className="moment-timing">{item.timing}</span>
                  </div>
                ))}
              </div>
            </section>

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
          </>
        )}
      </div>
    </div>
  )
}

function getMockData() {
  return {
    trending: [
      { platform: 'INSTAGRAM', format: 'Carousel', hook: 'Ring stack styling guide \u2014 show 3 ways to stack Harper\'s signature bands from minimal to bold' },
      { platform: 'TIKTOK', format: 'Reel', hook: 'GRWM for date night featuring a jewelry close-up transition reveal' },
      { platform: 'BOTH', format: 'Reel', hook: '"Jewelry I\'d buy myself" trend \u2014 self-love angle with Harper\'s everyday pieces' },
      { platform: 'INSTAGRAM', format: 'Static', hook: 'Flat-lay editorial with spring florals and gold pieces \u2014 warm tones, natural light' },
      { platform: 'TIKTOK', format: 'UGC', hook: 'Customer unboxing reactions \u2014 the velvet box moment' },
      { platform: 'BOTH', format: 'Carousel', hook: 'Jewelry care 101 \u2014 how to clean and store fine jewelry (educational + brand trust)' },
    ],
    moments: [
      { date: 'May 11', occasion: "Mother's Day", angle: 'Gift guide: "Pieces she\'ll never take off" \u2014 highlight sentimental everyday jewelry', timing: 'Start 14 days before' },
      { date: 'May 25', occasion: 'Memorial Day Weekend', angle: 'Summer jewelry edit \u2014 waterproof pieces, vacation styling', timing: 'Start 7 days before' },
      { date: 'Jun 1', occasion: 'Pride Month', angle: 'Celebration of love \u2014 rainbow-inspired styling, couples jewelry', timing: 'Post on June 1' },
      { date: 'Jun 8', occasion: 'Best Friends Day', angle: 'Matching jewelry sets, friendship pieces, tag-a-friend giveaway', timing: 'Start 5 days before' },
      { date: 'Jun 15', occasion: "Father's Day", angle: 'Unexpected angle \u2014 jewelry gifts from daughters to mothers who raised them solo', timing: 'Start 10 days before' },
    ],
    pillars: [
      { theme: 'Self-Purchase Celebration', why: 'Women are increasingly buying fine jewelry for themselves as markers of personal milestones \u2014 promotions, breakups, birthdays', ideas: ['Post: "You don\'t need an occasion" campaign', 'Reel: milestone moments that deserve jewelry', 'Carousel: 5 pieces under $500 to treat yourself'] },
      { theme: 'Wedding Season Prep', why: 'Peak engagement and wedding season drives search for bridal jewelry, bridesmaid gifts, and guest accessories', ideas: ['Instagram guide: Bridal jewelry by neckline', 'TikTok: Getting ready with the bride', 'Carousel: Bridesmaid gift sets at every price point'] },
      { theme: 'Everyday Luxury', why: 'Harper\'s audience values pieces that elevate daily outfits \u2014 not reserved for special occasions', ideas: ['Reel: Same outfit, 3 jewelry styling levels', 'Static: Close-up detail shots of texture and craftsmanship', 'Story series: How Harper\'s team styles their daily stacks'] },
      { theme: 'Behind the Craft', why: 'Transparency and craftsmanship build trust with luxury consumers who want to know the story', ideas: ['Reel: Workshop footage of pieces being made', 'Carousel: From sketch to final piece', 'TikTok: Sound-on ASMR polishing and setting stones'] },
    ],
  }
}
