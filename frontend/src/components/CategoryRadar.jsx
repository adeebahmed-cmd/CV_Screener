import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts'

export default function CategoryRadar({ scores }) {
  const data = Object.entries(scores || {}).map(([category, value]) => ({
    category,
    value: Number(value) || 0,
  }))

  return (
    <div className="w-full h-80">
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="75%">
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="category" tick={{ fontSize: 12, fill: '#334155' }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
          <Radar
            name="Score"
            dataKey="value"
            stroke="#1e40af"
            fill="#1e40af"
            fillOpacity={0.25}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
