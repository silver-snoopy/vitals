import { LineChart, Line } from 'recharts';
import { cn } from '@/lib/utils';

interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}

function Sparkline({
  data,
  color = 'var(--color-primary)',
  width = 80,
  height = 32,
  className,
}: SparklineProps) {
  const chartData = data.map((value) => ({ value }));

  return (
    <div className={cn('inline-block', className)}>
      <LineChart width={width} height={height} data={chartData}>
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </div>
  );
}

export { Sparkline };
export type { SparklineProps };
