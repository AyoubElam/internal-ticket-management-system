'use client'

import { useEffect, useState } from 'react'
import { Star, Trophy, Shield, Users2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import StatCard from '@/components/stat-card'

type TechnicianRating = {
  technician_id: number
  technician_name: string
  rating_count: number
  avg_rating: number | string | null
}

export default function RatingsLeaderboardPage() {
  const { user } = useAuth()
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
        <p className="text-muted-foreground text-sm">Access restricted.</p>
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
        <h1 className="text-xl font-bold text-foreground">Technician Ratings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Average rating across resolved/closed tickets</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Overall Average"
          value={overallAvg != null ? overallAvg.toFixed(2) : '—'}
          subtitle={totalRatings > 0 ? `across ${totalRatings} rating${totalRatings === 1 ? '' : 's'}` : 'No ratings yet'}
          icon={<Star className="w-4 h-4" />}
          color="amber"
        />
        <StatCard
          title="Top Technician"
          value={topTechnician ? topTechnician.technician_name : '—'}
          subtitle={topTechnician && topTechnician.avg_rating != null ? `${topTechnician.avg_rating.toFixed(2)} avg` : 'No ratings yet'}
          icon={<Trophy className="w-4 h-4" />}
          color="green"
        />
        <StatCard
          title="Technicians Rated"
          value={ranked.length}
          subtitle={unrated.length > 0 ? `${unrated.length} not yet rated` : 'All technicians rated'}
          icon={<Users2 className="w-4 h-4" />}
          color="blue"
        />
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading ratings…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && (
        <>
          {ranked.length === 0 && unrated.length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm">No technicians found.</div>
          )}

          {ranked.length > 0 && (
            <div className="bg-card shadow-sm rounded-2xl p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border/40 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      <th className="px-4 py-3 w-12">Rank</th>
                      <th className="px-4 py-3">Technician</th>
                      <th className="px-4 py-3">Rating</th>
                      <th className="px-4 py-3">Ratings Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {ranked.map((r, i) => (
                      <tr key={r.technician_id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            {i === 0 ? (
                              <Trophy className="w-4 h-4 text-amber-400" />
                            ) : (
                              <span className="text-xs text-muted-foreground w-4 text-center">{i + 1}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-foreground">{r.technician_name}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map(n => (
                                <Star
                                  key={n}
                                  className={cn(
                                    'w-3.5 h-3.5',
                                    n <= Math.round(r.avg_rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-border'
                                  )}
                                />
                              ))}
                            </div>
                            <span className="text-xs font-semibold text-foreground">
                              {r.avg_rating != null ? r.avg_rating.toFixed(2) : '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground">
                          {r.rating_count} rating{r.rating_count === 1 ? '' : 's'}
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
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">No ratings yet</p>
              <div className="flex flex-wrap gap-2">
                {unrated.map(r => (
                  <span
                    key={r.technician_id}
                    className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-full px-3 py-1.5"
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