import { Text, YStack } from '@calendar/ui';
import type { ScoreHistoryPoint } from '../../lib/habits/today';

interface HabitScoreHistoryChartProps {
  points: ScoreHistoryPoint[];
  color: string;
  width?: number;
  height?: number;
}

const GRIDLINES = [0, 20, 40, 60, 80, 100];

function formatAxisDate(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  return `${day}/${month}`;
}

/** A small inline-SVG line chart -- no charting library exists yet in this app, and one point per week for a habit's lifetime doesn't need one. */
export function HabitScoreHistoryChart({ points, color, width = 480, height = 160 }: HabitScoreHistoryChartProps) {
  const paddingLeft = 32;
  const paddingBottom = 20;
  const paddingTop = 8;
  const plotWidth = width - paddingLeft - 8;
  const plotHeight = height - paddingTop - paddingBottom;

  if (points.length < 2) {
    return (
      <YStack height={height} alignItems="center" justifyContent="center">
        <Text color="$muted" fontSize="$2">
          Todavia no hay suficiente historial para graficar.
        </Text>
      </YStack>
    );
  }

  const x = (index: number) => paddingLeft + (index / (points.length - 1)) * plotWidth;
  const y = (score: number) => paddingTop + plotHeight * (1 - score / 100);

  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point.score)}`).join(' ');

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
      {GRIDLINES.map((value) => (
        <g key={value}>
          <line
            x1={paddingLeft}
            x2={width - 8}
            y1={y(value)}
            y2={y(value)}
            stroke="rgba(255,255,255,0.08)"
            strokeDasharray="4 4"
          />
          <text x={0} y={y(value) + 4} fontSize={10} fill="#a9c2b4">
            {value}
          </text>
        </g>
      ))}

      <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {points.map((point, index) => (
        <circle key={point.date} cx={x(index)} cy={y(point.score)} r={3.5} fill={color} />
      ))}

      {points.map((point, index) => {
        if (points.length > 6 && index % 2 !== 0 && index !== points.length - 1) return null;
        return (
          <text
            key={`label-${point.date}`}
            x={x(index)}
            y={height - 4}
            fontSize={10}
            fill="#a9c2b4"
            textAnchor="middle"
          >
            {formatAxisDate(point.date)}
          </text>
        );
      })}
    </svg>
  );
}
