import { format, parseISO } from 'date-fns';
import type { DailyNutritionSummary } from '@vitals/shared';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

export function DailyNutritionTable({ data }: { data: DailyNutritionSummary[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No nutrition data for this period.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Calories</TableHead>
          <TableHead className="text-right">Protein (g)</TableHead>
          <TableHead className="text-right">Carbs (g)</TableHead>
          <TableHead className="text-right">Fat (g)</TableHead>
          <TableHead className="text-right">Fiber (g)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.date}>
            <TableCell>{format(parseISO(row.date), 'EEE, MMM d')}</TableCell>
            <TableCell className="text-right">{Math.round(row.calories)}</TableCell>
            <TableCell className="text-right">{Math.round(row.protein)}</TableCell>
            <TableCell className="text-right">{Math.round(row.carbs)}</TableCell>
            <TableCell className="text-right">{Math.round(row.fat)}</TableCell>
            <TableCell className="text-right">{Math.round(row.fiber)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
