import { useRef, useState, useEffect, useCallback } from 'react';
import type { DailyNutritionSummary, WorkoutSession, BiometricReading } from '@vitals/shared';
import { NutritionChart } from './NutritionChart';
import { WorkoutVolumeChart } from './WorkoutVolumeChart';
import { WeightChart } from './WeightChart';
import { ActivityHeatmap } from './ActivityHeatmap';

interface SwipeableChartsProps {
  nutrition: DailyNutritionSummary[];
  workouts: WorkoutSession[];
  biometrics: BiometricReading[];
}

const CHART_LABELS = ['Nutrition', 'Volume', 'Weight', 'Activity'];

export function SwipeableCharts({ nutrition, workouts, biometrics }: SwipeableChartsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.firstElementChild?.clientWidth ?? el.clientWidth;
    const index = Math.round(el.scrollLeft / cardWidth);
    setActiveIndex(Math.min(index, CHART_LABELS.length - 1));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return (
    <div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-none"
      >
        <div className="min-w-[calc(100vw-2rem)] snap-center">
          <NutritionChart data={nutrition} />
        </div>
        <div className="min-w-[calc(100vw-2rem)] snap-center">
          <WorkoutVolumeChart sessions={workouts} />
        </div>
        <div className="min-w-[calc(100vw-2rem)] snap-center">
          <WeightChart biometrics={biometrics} />
        </div>
        <div className="min-w-[calc(100vw-2rem)] snap-center">
          <ActivityHeatmap workouts={workouts} />
        </div>
      </div>
      {/* Dot indicators */}
      <div className="mt-3 flex justify-center gap-2">
        {CHART_LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            className={`h-2 w-2 rounded-full transition-colors ${
              i === activeIndex ? 'bg-primary' : 'bg-muted-foreground/30'
            }`}
            aria-label={`Go to ${label}`}
            onClick={() => {
              const el = scrollRef.current;
              if (!el) return;
              const cardWidth = el.firstElementChild?.clientWidth ?? el.clientWidth;
              el.scrollTo({ left: cardWidth * i, behavior: 'smooth' });
            }}
          />
        ))}
      </div>
    </div>
  );
}
