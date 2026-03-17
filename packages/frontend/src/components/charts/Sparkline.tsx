import { LineChart, Line } from 'recharts';

interface SparklineProps {
  data: Array<{ value: number }>;
  color?: string;
  width?: number;
  height?: number;
}

export function Sparkline({
  data,
  color = 'var(--color-primary)',
  width = 80,
  height = 40,
}: SparklineProps) {
  if (data.length < 2) return null;

  return (
    <LineChart width={width} height={height} data={data}>
      <Line
        type="monotone"
        dataKey="value"
        stroke={color}
        strokeWidth={1.5}
        dot={false}
        isAnimationActive={false}
      />
    </LineChart>
  );
}
