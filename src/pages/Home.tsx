import { useSupabaseQuery } from '../lib/useSupabaseQuery';
import { supabase } from '../lib/db';
import type { Exercise, RoutineDay } from '../lib/db';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
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

    return (
        <div className="p-4 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold">¡A entrenar! 💪</h1>
                <p className="text-muted-foreground text-sm">
                    Hoy es <span className="font-semibold text-foreground">{DAYS_OF_WEEK[todayNum]}</span>. Esta es tu rutina programada.
                </p>
            </div>

            <div className="flex flex-col gap-3">
                {isLoading ? (
                    <p className="text-muted-foreground text-sm text-center py-8">Cargando tu rutina...</p>
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
                    exercises.map((ex, index) => (
                        <Card
                            key={`${ex?.id}-${index}`}
                            className="active:scale-[0.98] transition-transform cursor-pointer hover:border-primary/50"
                            onClick={() => navigate(`/exercise/${ex?.id}`)}
                        >
                            <CardContent className="p-4 flex justify-between items-center gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                        {index + 1}
                                    </div>
                                    <span className="font-medium text-lg">{ex?.name}</span>
                                </div>
                                <ChevronRight className="text-muted-foreground" size={20} />
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
