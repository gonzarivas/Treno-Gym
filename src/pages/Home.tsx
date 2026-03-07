import { useSupabaseQuery } from '../lib/useSupabaseQuery';
import { supabase } from '../lib/db';
import type { Exercise, RoutineDay, WorkoutLog } from '../lib/db';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Dumbbell, CheckCircle2 } from 'lucide-react';
import { useMemo } from 'react';
import { getLocalDateString } from '../lib/utils';

const DAYS_OF_WEEK = [
    'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
];

export default function Home() {
    const navigate = useNavigate();

    // Get today's day_of_week number (0-6)
    const todayNum = useMemo(() => new Date().getDay(), []);
    const todayDate = useMemo(() => getLocalDateString(), []);

    // Fetch Routine for today
    const { data: todayRoutine, isLoading: isRoutineLoading } = useSupabaseQuery(
        async () => {
            const { data, error } = await supabase
                .from('routine_days')
                .select('*')
                .eq('day_of_week', todayNum)
                .single();

            if (error && error.code !== 'PGRST116') throw error; // PGRST116 is not found
            return data as RoutineDay | null;
        },
        [todayNum]
    );

    // Fetch Exercises for today's routine
    const { data: exercises, isLoading: isExercisesLoading } = useSupabaseQuery(
        async () => {
            if (!todayRoutine || !todayRoutine.exercise_ids || !todayRoutine.exercise_ids.length) return [];

            const { data, error } = await supabase
                .from('exercises')
                .select('*')
                .in('id', todayRoutine.exercise_ids);

            if (error) throw error;

            const exArray = data as Exercise[];
            // Restore order from routines array
            return todayRoutine.exercise_ids.map(id => exArray.find(e => e.id === id)).filter(Boolean) as Exercise[];
        },
        [todayRoutine]
    );

    // Fetch today's workout logs to determine completion status
    const { data: todayLogs } = useSupabaseQuery(
        async () => {
            if (!todayRoutine || !todayRoutine.exercise_ids || !todayRoutine.exercise_ids.length) return [];

            const { data, error } = await supabase
                .from('workout_logs')
                .select('*')
                .in('exercise_id', todayRoutine.exercise_ids)
                .eq('date', todayDate);

            if (error) throw error;
            return data as WorkoutLog[];
        },
        [todayRoutine, todayDate]
    );

    // Set of completed exercise IDs (those with at least one logged set today)
    const completedIds = useMemo(() => {
        if (!todayLogs) return new Set<number>();
        return new Set(
            todayLogs
                .filter(log => log.sets && log.sets.length > 0)
                .map(log => log.exercise_id)
        );
    }, [todayLogs]);

    // Consider loading if:
    // 1. Routine is loading, OR
    // 2. Exercises query is loading, OR
    // 3. We have a routine with exercises but exercises data hasn't arrived yet
    const isLoading = isRoutineLoading || isExercisesLoading ||
        (todayRoutine && todayRoutine.exercise_ids?.length > 0 && exercises === undefined);

    return (
        <div className="p-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    ¡A entrenar! <Dumbbell className="text-primary" />
                </h1>
                <p className="text-muted-foreground text-sm">
                    Hoy es <span className="font-bold text-primary tracking-wide text-base">{DAYS_OF_WEEK[todayNum]}</span>. Esta es tu rutina programada.
                </p>
            </div>

            {/* Progress indicator */}
            {exercises && exercises.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                            className="h-full bg-green-500 rounded-full transition-all duration-500"
                            style={{ width: `${(completedIds.size / exercises.length) * 100}%` }}
                        />
                    </div>
                    <span className="font-medium tabular-nums">{completedIds.size}/{exercises.length}</span>
                </div>
            )}

            <div className="flex flex-col gap-6">
                {isLoading ? (
                    <div className="flex flex-col gap-2 py-2">
                        <Skeleton className="h-[44px] w-full rounded-xl" />
                        <Skeleton className="h-[44px] w-full rounded-xl" />
                        <Skeleton className="h-[44px] w-full rounded-xl" />
                        <Skeleton className="h-[44px] w-full rounded-xl" />
                    </div>
                ) : exercises === undefined || exercises.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-4 py-12 px-4 border border-dashed rounded-xl border-border bg-muted/30 text-center">
                        <p className="text-muted-foreground text-sm">
                            No tienes ejercicios programados para hoy.
                        </p>
                        <Button variant="outline" onClick={() => navigate('/routine')}>
                            Configurar Rutina
                        </Button>
                    </div>
                ) : (
                    (() => {
                        const muscleGroups: Record<string, { ex: Exercise, index: number }[]> = {};
                        const groupOrder: string[] = [];

                        exercises.forEach((ex, index) => {
                            const muscle = ex.muscle_group || 'Otros';
                            if (!muscleGroups[muscle]) {
                                muscleGroups[muscle] = [];
                                groupOrder.push(muscle);
                            }
                            muscleGroups[muscle].push({ ex, index });
                        });

                        return groupOrder.map((muscle) => (
                            <div key={muscle} className="flex flex-col gap-2">
                                <span className="text-[10px] uppercase font-bold tracking-widest text-primary ml-1">
                                    {muscle}
                                </span>
                                <div className="flex flex-col gap-1.5">
                                    {muscleGroups[muscle].map(({ ex, index }) => {
                                        const swapKey = `treno_equip_swap_${todayDate}`;
                                        const swapsStr = localStorage.getItem(swapKey);
                                        const swaps = swapsStr ? JSON.parse(swapsStr) : {};
                                        const equipSwap = swaps[ex.id!];
                                        const currentEquip = equipSwap || ex.equipment;
                                        const isCompleted = completedIds.has(ex.id!);

                                        return (
                                            <Card
                                                key={`${ex?.id}-${index}`}
                                                className={`active:scale-[0.98] transition-all cursor-pointer shadow-none border-border/40 ${isCompleted
                                                    ? 'bg-green-500/5 border-green-500/30 hover:border-green-500/50'
                                                    : 'hover:border-primary/50'
                                                    }`}
                                                onClick={() => navigate(`/exercise/${ex?.id}`)}
                                            >
                                                <CardContent className="p-2 px-3 flex justify-between items-center gap-2">
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className={`w-6 h-6 rounded-sm flex items-center justify-center font-bold text-xs shrink-0 ${isCompleted
                                                            ? 'bg-green-500/15 text-green-500'
                                                            : 'bg-primary/10 text-primary'
                                                            }`}>
                                                            {isCompleted ? (
                                                                <CheckCircle2 size={14} />
                                                            ) : (
                                                                index + 1
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className={`font-medium text-sm leading-tight truncate ${isCompleted ? 'text-muted-foreground line-through decoration-green-500/50' : ''
                                                                }`}>
                                                                {ex?.name}
                                                            </span>
                                                            <div className="flex items-center gap-1.5 text-[10px] leading-tight">
                                                                {currentEquip && (
                                                                    <span className="text-muted-foreground">
                                                                        {currentEquip}
                                                                    </span>
                                                                )}
                                                                {equipSwap && (
                                                                    <span className="text-primary font-bold uppercase tracking-tighter">
                                                                        (cambio)
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="text-muted-foreground/50 shrink-0" size={14} />
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>
                        ));
                    })()
                )}
            </div>
        </div>
    );
}
