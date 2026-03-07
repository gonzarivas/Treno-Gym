import { useState, useMemo } from 'react';
import { useSupabaseQuery } from '../lib/useSupabaseQuery';
import { supabase } from '../lib/db';
import type { Exercise, WorkoutLog } from '../lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

export default function Stats() {
    const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string | null>(null);
    const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);

    // Fetch all exercises to populate the dropdown
    const { data: exercises, isLoading: isExLoading } = useSupabaseQuery(
        async () => {
            // Fetch all exercises from the database
            const { data, error } = await supabase
                .from('exercises')
                .select('*')
                .order('name');

            if (error) throw error;
            return data as Exercise[];
        },
        []
    );

    // Group exercises by muscle group
    const exercisesByMuscle = useMemo(() => {
        if (!exercises) return {};
        const groups: Record<string, Exercise[]> = {};
        exercises.forEach(ex => {
            const muscle = ex.muscle_group || 'Otros';
            if (!groups[muscle]) groups[muscle] = [];
            groups[muscle].push(ex);
        });
        return groups;
    }, [exercises]);

    const muscleGroups = useMemo(() => {
        return Object.keys(exercisesByMuscle).sort((a, b) => {
            const countA = exercisesByMuscle[a].length;
            const countB = exercisesByMuscle[b].length;
            if (countB !== countA) return countB - countA;
            return a.localeCompare(b); // Alphabetical fallback
        });
    }, [exercisesByMuscle]);

    // Set default selected muscle and exercise when exercises load
    useMemo(() => {
        if (muscleGroups.length > 0 && selectedMuscleGroup === null) {
            setSelectedMuscleGroup(muscleGroups[0]);
        }
    }, [muscleGroups, selectedMuscleGroup]);

    useMemo(() => {
        if (selectedMuscleGroup && exercisesByMuscle[selectedMuscleGroup] && selectedExerciseId === null) {
            setSelectedExerciseId(exercisesByMuscle[selectedMuscleGroup][0].id!);
        }
    }, [selectedMuscleGroup, exercisesByMuscle, selectedExerciseId]);

    // Fetch all logs for the selected exercise
    const { data: exerciseLogs } = useSupabaseQuery(
        async () => {
            if (!selectedExerciseId) return [];
            const { data, error } = await supabase
                .from('workout_logs')
                .select('*')
                .eq('exercise_id', selectedExerciseId)
                .order('date', { ascending: true });
            if (error) throw error;
            return data as WorkoutLog[];
        },
        [selectedExerciseId]
    );

    // Calculate chart data based on logs
    const chartData = useMemo(() => {
        if (!exerciseLogs) return [];

        return exerciseLogs.map((log) => {
            // Find max weight used in this session
            const maxWeight = log.sets.reduce((max, set) => {
                // Normalize to KG for the chart if possible, or just use what's there
                return Math.max(max, set.weight);
            }, 0);

            // Find total volume (sets * reps * weight)
            const volume = log.sets.reduce((total, set) => total + (set.reps * set.weight), 0);
            // Total sets
            const totalSets = log.sets.length;

            return {
                date: new Date(log.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                maxWeight,
                volume,
                totalSets,
            };
        });
    }, [exerciseLogs]);

    const isLoading = exercises === undefined || isExLoading;

    return (
        <div className="p-4 flex flex-col gap-6 pb-24">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    Estadísticas <TrendingUp className="text-primary" />
                </h1>
                <p className="text-muted-foreground text-sm">Visualiza tu progreso por grupo muscular.</p>
            </div>

            <div className="flex flex-col gap-4">
                {/* Selection Section */}
                {isLoading ? (
                    <div className="flex flex-col gap-4 py-2">
                        <Skeleton className="h-[70px] w-full rounded-xl" />
                        <Skeleton className="h-[100px] w-full rounded-xl mt-2" />
                        <Skeleton className="h-[300px] w-full rounded-xl mt-4" />
                    </div>
                ) : muscleGroups.length > 0 ? (
                    <div className="flex flex-col gap-6">
                        {/* Muscle Group Selection */}
                        <div className="flex flex-col gap-3">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Grupo Muscular</span>
                            <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar -mx-1 px-1">
                                {muscleGroups.map((group) => {
                                    const count = exercisesByMuscle[group]?.length || 0;
                                    const isSelected = selectedMuscleGroup === group;
                                    return (
                                        <Button
                                            key={group}
                                            variant={isSelected ? 'default' : 'outline'}
                                            className={`
                                                min-w-fit rounded-xl px-4 h-12 flex flex-col items-center justify-center gap-0 transition-all active:scale-95
                                                ${isSelected ? 'shadow-lg shadow-primary/20 bg-primary ring-2 ring-primary/20' : 'bg-card border-border/40 hover:border-primary/50'}
                                            `}
                                            onClick={() => {
                                                setSelectedMuscleGroup(group);
                                                if (exercisesByMuscle[group] && exercisesByMuscle[group].length > 0) {
                                                    setSelectedExerciseId(exercisesByMuscle[group][0].id!);
                                                }
                                            }}
                                        >
                                            <span className="text-sm font-bold leading-tight">{group}</span>
                                            <span className={`text-[9px] font-medium leading-tight opacity-70 ${isSelected ? 'text-primary-foreground' : 'text-primary'}`}>
                                                {count} {count === 1 ? 'ejercicio' : 'ejercicios'}
                                            </span>
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Exercise Selection */}
                        <div className="flex flex-col gap-3">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Ejercicio</span>
                            <div className="flex flex-wrap gap-2">
                                {selectedMuscleGroup && exercisesByMuscle[selectedMuscleGroup]?.map((ex: Exercise) => {
                                    const isSelected = selectedExerciseId === ex.id;
                                    return (
                                        <Button
                                            key={ex.id}
                                            variant={isSelected ? 'default' : 'outline'}
                                            size="sm"
                                            className={`
                                                rounded-lg px-3 py-1.5 h-auto text-xs font-semibold active:scale-95 transition-all
                                                ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted/40 border-border/60'}
                                            `}
                                            onClick={() => setSelectedExerciseId(ex.id!)}
                                        >
                                            {ex.name}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    <p className="text-muted-foreground text-sm">No tienes ejercicios registrados para ver estadísticas.</p>
                )}

                {/* Charts */}
                {selectedExerciseId && chartData.length > 0 ? (
                    <>
                        <Card className="shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-semibold">Peso Máximo (kg/lb)</CardTitle>
                                <p className="text-xs text-muted-foreground">Tu carga máxima en cada sesión</p>
                            </CardHeader>
                            <CardContent className="h-[250px] pt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                        <XAxis dataKey="date" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px' }}
                                            itemStyle={{ color: '#e5e7eb' }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="maxWeight"
                                            name="Peso Max"
                                            stroke="#8b5cf6"
                                            strokeWidth={3}
                                            dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2 }}
                                            activeDot={{ r: 6 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-semibold">Volumen Total</CardTitle>
                                <p className="text-xs text-muted-foreground">Peso × Reps sumado por sesión</p>
                            </CardHeader>
                            <CardContent className="h-[250px] pt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                        <XAxis dataKey="date" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px' }}
                                            itemStyle={{ color: '#e5e7eb' }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="volume"
                                            name="Volumen"
                                            stroke="#10b981"
                                            strokeWidth={3}
                                            dot={{ r: 4, fill: '#10b981', strokeWidth: 2 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </>
                ) : selectedExerciseId ? (
                    <div className="text-center py-12 px-4 border border-dashed rounded-xl border-border bg-muted/20 mt-4">
                        <p className="text-muted-foreground text-sm">Aún no hay datos de entrenamiento registrados para este ejercicio.</p>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
