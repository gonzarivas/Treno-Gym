import { useState, useMemo } from 'react';
import { useSupabaseQuery } from '../lib/useSupabaseQuery';
import { supabase } from '../lib/db';
import type { Exercise, WorkoutLog } from '../lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

export default function Stats() {
    const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);

    // Fetch all exercises to populate the dropdown
    const { data: exercises, isLoading: isExLoading } = useSupabaseQuery(
        async () => {
            // First find which exercises are currently in routines
            const { data: routinesData, error: routinesError } = await supabase
                .from('routine_days')
                .select('exercise_ids');

            if (routinesError) throw routinesError;

            const routineExerciseIds = new Set<number>();
            (routinesData || []).forEach(day => {
                (day.exercise_ids || []).forEach((id: number) => routineExerciseIds.add(id));
            });

            if (routineExerciseIds.size === 0) return [];

            // Then fetch those exercises
            const { data, error } = await supabase
                .from('exercises')
                .select('*')
                .in('id', Array.from(routineExerciseIds))
                .order('name');

            if (error) throw error;
            return data as Exercise[];
        },
        []
    );

    // Set default selected exercise when exercises load
    if (exercises && exercises.length > 0 && selectedExerciseId === null) {
        setSelectedExerciseId(exercises[0].id!);
    }

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
            const maxWeight = log.sets.reduce((max, set) => Math.max(max, set.weight), 0);
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
                <p className="text-muted-foreground text-sm">Visualiza tu progreso a lo largo del tiempo.</p>
            </div>

            <div className="flex flex-col gap-4">
                {/* Exercise Selection */}
                {isLoading ? (
                    <div className="flex justify-center items-center py-12">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : exercises && exercises.length > 0 ? (
                    <div className="flex flex-col gap-2">
                        <Select
                            value={selectedExerciseId?.toString() || ''}
                            onValueChange={(v) => setSelectedExerciseId(Number(v))}
                        >
                            <SelectTrigger className="w-full h-12 bg-card">
                                <SelectValue placeholder="Selecciona un ejercicio" />
                            </SelectTrigger>
                            <SelectContent>
                                {exercises.map((ex: Exercise) => (
                                    <SelectItem key={ex.id} value={ex.id!.toString()}>
                                        {ex.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
