# @vitals/shared

Shared TypeScript types, interfaces, and constants used across all Vitals packages.

## Exports

### Interfaces
- **`AIProvider`**, `AIMessage`, `AICompletionResult`, `AIProviderConfig` — AI service contract
- **`DataProvider`**, `CollectionResult` — Data collection provider contract
- **`ApiResponse<T>`**, `ApiError`, `DateRangeParams`, `CollectRequest`, `GenerateReportRequest` — API shapes

### Types
- **`NutritionRecord`**, `DailyNutritionSummary` — Nutrition data
- **`WorkoutSet`**, `WorkoutSession`, `ExerciseProgress` — Workout data
- **`BiometricReading`**, `BiometricMetric` — Biometric measurements
- **`WeeklyReport`**, `WeeklyDataBundle`, `ActionItem` — AI report structures

### Constants
- **`METRICS`** — Metric name constants (`weight_kg`, `body_fat_pct`, etc.)
- **`UNITS`** — Unit constants (`kcal`, `kg`, `seconds`, `meters`)
- **`QUERY_KEYS`** — React Query key factories

## Usage

```typescript
import type { AIProvider, WeeklyReport } from '@vitals/shared';
import { METRICS, QUERY_KEYS } from '@vitals/shared';
```

## Scripts

```bash
npm run build    # Compile TypeScript to dist/
npm run clean    # Remove dist/
```

## Adding New Types

1. Create or edit a file in `src/types/` or `src/interfaces/`
2. Use `interface` (not `type`) for object shapes
3. Export from the file
4. Re-export from `src/index.ts`
5. Run `npm run build` — other packages import from the compiled output
