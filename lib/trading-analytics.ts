export type Trade = {
  id: string
  date: string
  result: 'win' | 'loss'
  amount: number
  risk?: number
  rr?: number
  heldTooLong: boolean
  ownTrade: boolean
  normalStopLoss?: boolean
  createdAt: string
}

export function getStats(trades: Trade[]) {
  const wins = trades.filter((t) => t.result === 'win')
  const losses = trades.filter((t) => t.result === 'loss')
  const activeDays = new Set(trades.map((t) => t.date)).size
  const totalProfit = wins.reduce((sum, t) => sum + t.amount, 0)
  const totalLoss = losses.reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const avgWin = wins.length ? totalProfit / wins.length : 0
  const avgLoss = losses.length ? totalLoss / losses.length : 0
  const expectancy = trades.length ? (wins.length / trades.length) * avgWin - (losses.length / trades.length) * avgLoss : 0
  const avgRR = avgLoss > 0 ? avgWin / avgLoss : 0
  return {
    balance: totalProfit - totalLoss,
    totalProfit,
    totalLoss,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    avgRR,
    avgTrades: activeDays ? trades.length / activeDays : 0,
    expectancy,
    avgWin,
    avgLoss,
    expectancyR: avgLoss > 0 ? expectancy / avgLoss : (expectancy > 0 ? 1 : 0),
    heldRate: trades.length ? trades.filter((t) => t.heldTooLong).length / trades.length : 0,
    ownRate: trades.length ? trades.filter((t) => t.ownTrade).length / trades.length : 0,
    normalStopRate: losses.length ? losses.filter((t) => t.normalStopLoss).length / losses.length : 0,
  }
}

export function getQuality(trades: Trade[]) {
  const s = getStats(trades)
  const labels = ['Discipline', 'Win Rate', 'Risk / Reward', 'Trade Frequency', 'Stop Discipline', 'Own Trades']
  if (trades.length < 3) {
    return {
      scores: [0, 0, 0, 0, 0, 0],
      strongest: '—',
      weakest: '—',
      issue: 'Insufficient sample',
      advice: 'Keep logging trades before drawing conclusions.',
    }
  }

  const dailyCounts = Array.from(new Map(trades.map((t) => [t.date, 0])).keys()).map(
    (date) => trades.filter((t) => t.date === date).length,
  )

  const baseFrequency =
    s.avgTrades <= 3 ? 100 :
    s.avgTrades <= 6 ? 95 :
    s.avgTrades <= 10 ? 90 - (s.avgTrades - 6) * 2.5 :
    s.avgTrades <= 15 ? 80 - (s.avgTrades - 10) * 4 :
    s.avgTrades <= 20 ? 60 - (s.avgTrades - 15) * 6 :
    Math.max(0, 30 - (s.avgTrades - 20) * 3)

  const overTradingPenalty = dailyCounts.reduce((penalty, count) => {
    if (count > 20) return penalty + 10
    if (count > 15) return penalty + 5
    return penalty
  }, 0)
  const frequency = Math.max(0, Math.min(100, baseFrequency - Math.min(30, overTradingPenalty)))

  const rrAnchors = [
    [0.5, 0], [0.6, 15], [0.8, 30], [1.0, 45], [1.25, 60], [1.5, 70],
    [2.0, 80], [2.5, 85], [3.0, 90], [3.5, 93], [4.0, 95], [5.0, 100],
  ] as const

  const rrScore = s.avgRR <= rrAnchors[0][0]
    ? rrAnchors[0][1]
    : s.avgRR >= rrAnchors[rrAnchors.length - 1][0]
      ? rrAnchors[rrAnchors.length - 1][1]
      : (() => {
          for (let i = 1; i < rrAnchors.length; i++) {
            const [x1, y1] = rrAnchors[i - 1]
            const [x2, y2] = rrAnchors[i]
            if (s.avgRR <= x2) return y1 + (s.avgRR - x1) * (y2 - y1) / (x2 - x1)
          }
          return 0
        })()

  const scores = [
    Math.round((1 - s.heldRate) * 100),
    Math.round(s.winRate),
    Math.round(rrScore),
    Math.round(frequency),
    Math.round((1 - s.heldRate) * 100),
    Math.round(s.ownRate * 100),
  ]
  const weakestIndex = scores.indexOf(Math.min(...scores))
  const strongestIndex = scores.indexOf(Math.max(...scores))
  const issue = weakestIndex === 3 ? `${labels[weakestIndex]} is elevated` : `${labels[weakestIndex]} needs improvement`
  const advice = weakestIndex === 3
    ? 'Reduce low-quality trades and wait for setups that fit your model.'
    : weakestIndex === 4
      ? 'Respect predefined stops and prevent small losses from expanding.'
      : 'Keep logging and watch how this dimension changes.'

  return { scores, strongest: labels[strongestIndex], weakest: labels[weakestIndex], issue, advice }
}

export function formatMoney(value: number) {
  return `${value >= 0 ? '+' : '-'}$${Math.abs(value).toFixed(0)}`
}

export function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

export function equityPoints(trades: Trade[], startingCapital = 0) {
  if (!trades.length && startingCapital === 0) return []
  let total = startingCapital
  const points = [{ date: 'Start', value: startingCapital, timestamp: new Date(0).getTime() }]
  return points.concat(
    [...trades]
      .sort((a, b) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime())
      .map((trade) => {
        total += trade.amount
        return { date: trade.date.slice(5), value: total, timestamp: new Date(trade.createdAt || trade.date).getTime() }
      }),
  )
}

export function monthDays(year: number, month: number) {
  const first = new Date(year, month, 1).getDay()
  const count = new Date(year, month + 1, 0).getDate()
  return [...Array(first === 0 ? 6 : first - 1)].map(() => null).concat([...Array(count)].map((_, i) => i + 1))
}
