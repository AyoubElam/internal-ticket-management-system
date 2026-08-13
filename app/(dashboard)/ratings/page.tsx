'use client'

import { useEffect, useState } from 'react'
import { Star, Trophy, Shield, Users2, MessageSquare, TrendingUp } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useLanguage } from '@/lib/i18n/language-context'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/helpers'
import StatCard from '@/components/stat-card'

type TechnicianRating = {
  technician_id: number
  technician_name: string
  rating_count: number
  avg_rating: number | string | null
}

type RecentRating = {
  rating: number
  comment: string | null
  created_at: string
  ticket_id: number
  employee_name?: string // present for admin/agent only — stripped for technicians server-side
}

type TechnicianRatingDetail = {
  technician_id: number
  rating_count: number
  avg_rating: number | string | null
  recent: RecentRating[]
}

export default function RatingsLeaderboardPage() {
  const { user } = useAuth()

  if (user?.role === 'technician') {
    return <TechnicianRatingsView />
  }

  return <LeaderboardView />
}

/* ────────────────────────────────────────────────────────────
   Technician view — personal stats only. Read-only: no edit,
   delete, or reply on any rating, and no reviewer identity.
   ──────────────────────────────────────────────────────────── */
function TechnicianRatingsView() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [detail, setDetail] = useState<TechnicianRatingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    async function fetchMyRatings() {
      setLoading(true)
      setError('')
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`http://localhost:4000/api/ratings/technician/${user!.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load your ratings.')
        setDetail(data)
      } catch (err: any) {
        setError(err.message || 'Something went wrong.')
      } finally {
        setLoading(false)
      }
    }
    fetchMyRatings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  if (loading) {
    return <p className="text-sm text-muted-foreground py-10 text-center">{t('ratings.loading')}</p>
  }

  if (error) {
    return <p className="text-sm text-destructive py-10 text-center">{error}</p>
  }

  const avg = detail?.avg_rating != null ? Number(detail.avg_rating) : null
  const count = detail?.rating_count ?? 0
  const recent = detail?.recent ?? []

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">{t('ratings.my_title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('ratings.my_subtitle')}</p>
      </div>

      {/* Overall stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          title={t('ratings.overall_average')}
          value={avg != null ? avg.toFixed(2) : '—'}
          subtitle={count > 0 ? `${t('ratings.based_on')} ${count} ${count === 1 ? t('ratings.ticket_s') : t('ratings.tickets')}` : t('ratings.no_ratings')}
          icon={<Star className="w-4 h-4" />}
          color="amber"
        />
        <StatCard
          title={t('ratings.tickets_rated')}
          value={count}
          subtitle={count > 0 ? t('ratings.keep_it_up') : t('ratings.complete_more')}
          icon={<TrendingUp className="w-4 h-4" />}
          color="green"
        />
      </div>

      {/* Big overall rating banner */}
      {count > 0 && avg != null && (
        <div className="bg-card/80 backdrop-blur-sm border border-border/20 shadow-soft rounded-3xl p-8 flex flex-col items-center text-center gap-3 transition-all hover:shadow-glow duration-300">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map(n => (
              <Star
                key={n}
                className={cn(
                  'w-8 h-8',
                  n <= Math.round(avg) ? 'fill-amber-400 text-amber-400 drop-shadow-sm' : 'text-border/40'
                )}
              />
            ))}
          </div>
          <p className="text-4xl font-black text-foreground">{avg.toFixed(2)} <span className="text-2xl text-muted-foreground font-bold">/ 5</span></p>
          <p className="text-sm font-semibold text-muted-foreground">
            {t('ratings.overall_rating_across')} {count} {count === 1 ? t('ratings.completed_ticket') : t('ratings.completed_tickets')}
          </p>
        </div>
      )}

      {/* Per-ticket ratings — no reviewer name, read-only */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('ratings.recent_ratings')}</p>

        {recent.length === 0 && (
          <div className="bg-card/80 backdrop-blur-sm border border-border/20 shadow-soft rounded-3xl p-10 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-bold text-muted-foreground">{t('ratings.no_ratings_yet_desc')}</p>
          </div>
        )}

        {recent.length > 0 && (
          <div className="bg-card/80 backdrop-blur-sm shadow-soft border border-border/20 rounded-3xl overflow-hidden divide-y divide-border/20">
            {recent.map((r, i) => (
              <div key={i} className="p-6 flex items-start gap-4 hover:bg-muted/10 transition-colors">
                <div className="flex items-center gap-1 shrink-0 pt-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <Star
                      key={n}
                      className={cn(
                        'w-4 h-4',
                        n <= r.rating ? 'fill-amber-400 text-amber-400 drop-shadow-sm' : 'text-border/40'
                      )}
                    />
                  ))}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-mono font-bold text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-md">{t('ratings.ticket_hash')}{r.ticket_id}</span>
                    <span className="text-xs font-semibold text-muted-foreground">{formatDateTime(r.created_at)}</span>
                  </div>
                  {r.comment ? (
                    <p className="text-sm font-medium text-foreground/80 leading-relaxed">{r.comment}</p>
                  ) : (
                    <p className="text-sm font-medium text-muted-foreground/60 italic">{t('ratings.no_comment')}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   Admin / agent view — full leaderboard across all technicians.
   ──────────────────────────────────────────────────────────── */
function LeaderboardView() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [ratings, setRatings] = useState<TechnicianRating[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const canView = user && ['admin', 'support_agent'].includes(user.role)

  useEffect(() => {
    if (!canView) return
    async function fetchRatings() {
      setLoading(true)
      setError('')
      try {
        const token = localStorage.getItem('token')
        const res = await fetch('http://localhost:4000/api/ratings/summary', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load ratings.')
        setRatings(data)
      } catch (err: any) {
        setError(err.message || 'Something went wrong.')
      } finally {
        setLoading(false)
      }
    }
    fetchRatings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView])

  if (!user || !['admin', 'support_agent'].includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Shield className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">{t('dashboard.access_restricted')}</p>
      </div>
    )
  }

  // mysql2 returns DECIMAL/ROUND() results as strings, not numbers — coerce
  // once here so every consumer below can safely call .toFixed()/compare.
  const normalized = ratings.map(r => ({
    ...r,
    avg_rating: r.avg_rating != null ? Number(r.avg_rating) : null,
  }))

  const ranked = normalized.filter(r => r.rating_count > 0)
  const unrated = normalized.filter(r => r.rating_count === 0)

  const totalRatings = ranked.reduce((sum, r) => sum + r.rating_count, 0)
  const overallAvg = totalRatings > 0
    ? ranked.reduce((sum, r) => sum + (r.avg_rating || 0) * r.rating_count, 0) / totalRatings
    : null
  const topTechnician = ranked[0] ?? null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">{t('ratings.title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('ratings.subtitle')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title={t('ratings.overall_average')}
          value={overallAvg != null ? overallAvg.toFixed(2) : '—'}
          subtitle={totalRatings > 0 ? `${t('ratings.based_on')} ${totalRatings} ${t('ratings.tickets')}` : t('ratings.no_ratings')}
          icon={<Star className="w-4 h-4" />}
          color="amber"
        />
        <StatCard
          title={t('ratings.top_technician')}
          value={topTechnician ? topTechnician.technician_name : '—'}
          subtitle={topTechnician && topTechnician.avg_rating != null ? `${topTechnician.avg_rating.toFixed(2)} avg` : t('ratings.no_ratings')}
          icon={<Trophy className="w-4 h-4" />}
          color="green"
        />
        <StatCard
          title={t('ratings.technicians_rated')}
          value={ranked.length}
          subtitle={unrated.length > 0 ? `${unrated.length} ${t('ratings.not_yet_rated')}` : t('ratings.all_rated')}
          icon={<Users2 className="w-4 h-4" />}
          color="blue"
        />
      </div>

      {loading && <p className="text-sm text-muted-foreground">{t('ratings.loading')}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && (
        <>
          {ranked.length === 0 && unrated.length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm">{t('ratings.no_technicians')}</div>
          )}

          {ranked.length > 0 && (
            <div className="bg-card/80 backdrop-blur-sm shadow-soft border border-border/20 rounded-3xl p-6 hover:shadow-glow transition-all duration-300">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border/40 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      <th className="px-4 py-3 w-12">{t('ratings.rank')}</th>
                      <th className="px-4 py-3">{t('ratings.technician')}</th>
                      <th className="px-4 py-3">{t('ratings.rating')}</th>
                      <th className="px-4 py-3">{t('ratings.ratings_count')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {ranked.map((r, i) => (
                      <tr key={r.technician_id} className="hover:bg-muted/10 transition-colors group">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5">
                            {i === 0 ? (
                              <div className="w-6 h-6 rounded-full bg-amber-400/20 flex items-center justify-center">
                                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                              </div>
                            ) : (
                              <span className="text-xs font-bold text-muted-foreground w-6 text-center">{i + 1}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 font-bold text-foreground">{r.technician_name}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map(n => (
                                <Star
                                  key={n}
                                  className={cn(
                                    'w-4 h-4',
                                    n <= Math.round(r.avg_rating || 0) ? 'fill-amber-400 text-amber-400 drop-shadow-sm' : 'text-border/40'
                                  )}
                                />
                              ))}
                            </div>
                            <span className="text-sm font-bold text-foreground">
                              {r.avg_rating != null ? r.avg_rating.toFixed(2) : '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs font-semibold text-muted-foreground">
                          {r.rating_count} {r.rating_count === 1 ? t('ratings.ticket_s') : t('ratings.tickets')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {unrated.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('ratings.no_ratings')}</p>
              <div className="flex flex-wrap gap-2">
                {unrated.map(r => (
                  <span
                    key={r.technician_id}
                    className="text-xs font-bold text-muted-foreground bg-card/80 backdrop-blur-sm border border-border/20 shadow-soft rounded-xl px-4 py-2"
                  >
                    {r.technician_name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}