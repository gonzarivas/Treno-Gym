import { useSupabaseQuery } from '../lib/useSupabaseQuery';
import { supabase } from '../lib/db';
import type { Exercise, RoutineDay } from '../lib/db';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Dumbbell } from 'lucide-react';
import { useMemo } from 'react';

const DAYS_OF_WEEK = [
    'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
];

export default function Home() {
    const navigate = useNavigate();

    // Get today's day_of_week number (0-6)
    const todayNum = useMemo(() => new Date().getDay(), []);

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

    const isLoading = isRoutineLoading || isExercisesLoading;

    // Group exercises by muscle group
    const groupedExercises = useMemo(() => {
        if (!exercises) return {};

        const groups: Record<string, typeof exercises> = {};
        for (const ex of exercises) {
            if (!ex) continue;
            const groupName = ex.muscle_group || 'Otros';
            if (!groups[groupName]) groups[groupName] = [];
            groups[groupName].push(ex);
        }
        return groups;
    }, [exercises]);

    return (
        <div className="p-4 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    ¡A entrenar! <Dumbbell className="text-primary" />
                </h1>
                <p className="text-muted-foreground text-sm">
                    Hoy es <span className="font-bold text-primary tracking-wide text-base">{DAYS_OF_WEEK[todayNum]}</span>. Esta es tu rutina programada.
                </p>
            </div>

            <div className="flex flex-col gap-3">
                {isLoading ? (
                    <div className="flex flex-col gap-4 py-2">
                        <Skeleton className="h-5 w-24 mb-1" />
                        <Skeleton className="h-[52px] w-full rounded-xl" />
                        <Skeleton className="h-[52px] w-full rounded-xl" />
                        <Skeleton className="h-[52px] w-full rounded-xl" />
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
                    Object.entries(groupedExercises).map(([groupName, groupExercises]) => (
                        <div key={groupName} className="flex flex-col gap-2 mb-2">
                            <h2 className="text-sm font-semibold text-muted-foreground px-1 uppercase tracking-wider">
                                {groupName}
                            </h2>
                            <div className="flex flex-col gap-2">
                                {groupExercises.map((ex, index) => {
                                    const todayDate = new Date().toISOString().split('T')[0];
                                    const swapKey = `treno_swap_${todayDate}`;
                                    const swapsStr = localStorage.getItem(swapKey);
                                    const swaps = swapsStr ? JSON.parse(swapsStr) : {};
                                    const variantId = swaps[ex.id!];

                                    return (
                                        <Card
                                            key={`${ex?.id}-${index}`}
                                            className="active:scale-[0.98] transition-transform cursor-pointer hover:border-primary/50 shadow-none border-border/40"
                                            onClick={() => navigate(`/exercise/${variantId || ex?.id}`)}
                                        >
                                            <CardContent className="p-2.5 px-3 flex justify-between items-center gap-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-7 h-7 rounded-sm bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                                        {index + 1}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-sm">{ex?.name}</span>
                                                        {variantId && (
                                                            <span className="text-[10px] text-primary font-bold uppercase tracking-tighter">
                                                                Sustituido por variante
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <ChevronRight className="text-muted-foreground/50" size={16} />
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
