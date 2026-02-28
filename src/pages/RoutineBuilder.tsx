import { useState } from 'react';
import { useSupabaseQuery } from '../lib/useSupabaseQuery';
import { supabase } from '../lib/db';
import type { Exercise, RoutineDay } from '../lib/db';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Plus, Trash2 } from 'lucide-react';

const DAYS_OF_WEEK = [
    { id: 1, label: 'Lunes' },
    { id: 2, label: 'Martes' },
    { id: 3, label: 'Miércoles' },
    { id: 4, label: 'Jueves' },
    { id: 5, label: 'Viernes' },
    { id: 6, label: 'Sábado' },
    { id: 0, label: 'Domingo' },
];

export default function RoutineBuilder() {
    const [activeDay, setActiveDay] = useState(1); // Default to Monday
    const [isAddingMode, setIsAddingMode] = useState(false);
    const [newExerciseName, setNewExerciseName] = useState('');

    // Fetch Routine Day
    const { data: routineDay, isLoading: isRoutineDayLoading, refetch: refetchRoutineDay } = useSupabaseQuery(
        async () => {
            const { data, error } = await supabase
                .from('routine_days')
                .select('*')
                .eq('day_of_week', activeDay)
                .single();
            if (error && error.code !== 'PGRST116') throw error; // PGRST116 means no rows found
            return data as RoutineDay | null;
        },
        [activeDay]
    );

    // Fetch Exercises for this day
    const { data: exercises, isLoading: isExercisesLoading } = useSupabaseQuery(
        async () => {
            if (!routineDay || !routineDay.exercise_ids || !routineDay.exercise_ids.length) return [];
            const { data, error } = await supabase
                .from('exercises')
                .select('*')
                .in('id', routineDay.exercise_ids);
            if (error) throw error;
            return data as Exercise[];
        },
        [routineDay]
    );

    const handleCreateExercise = async () => {
        if (!newExerciseName.trim()) return;

        try {
            // 1. Create the exercise
            const { data: exData, error: exError } = await supabase
                .from('exercises')
                .insert([{ name: newExerciseName.trim() }])
                .select('id')
                .single();

            if (exError) throw exError;
            const exerciseId = exData.id;

            // 2. Add to routineDay
            if (routineDay && routineDay.id !== undefined) {
                const { error: updateError } = await supabase
                    .from('routine_days')
                    .update({ exercise_ids: [...routineDay.exercise_ids, exerciseId] })
                    .eq('id', routineDay.id);
                if (updateError) throw updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('routine_days')
                    .insert([{
                        day_of_week: activeDay,
                        exercise_ids: [exerciseId]
                    }]);
                if (insertError) throw insertError;
            }

            setNewExerciseName('');
            setIsAddingMode(false);
            refetchRoutineDay(); // Refetch routine day to get updated exercise_ids
        } catch (e) {
            console.error(e);
        }
    };

    const handleRemoveExerciseFromDay = async (exerciseId: number) => {
        if (!routineDay || routineDay.id === undefined) return;

        try {
            const { error } = await supabase
                .from('routine_days')
                .update({
                    exercise_ids: routineDay.exercise_ids.filter((id: number) => id !== exerciseId)
                })
                .eq('id', routineDay.id);

            if (error) throw error;
            refetchRoutineDay(); // Refetch routine day to get updated exercise_ids
        } catch (e) {
            console.error(e);
        }
    };

    const isLoading = isRoutineDayLoading || isExercisesLoading;

    return (
        <div className="p-4 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold">Rutina Semanal</h1>
                <p className="text-muted-foreground text-sm">Selecciona un día para organizar tus ejercicios.</p>
            </div>

            {/* Days Tabs */}
            <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
                {DAYS_OF_WEEK.map((day) => (
                    <Button
                        key={day.id}
                        variant={activeDay === day.id ? 'default' : 'outline'}
                        className="min-w-fit rounded-full"
                        onClick={() => setActiveDay(day.id)}
                    >
                        {day.label}
                    </Button>
                ))}
            </div>

            {/* Exercises List */}
            <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold">{DAYS_OF_WEEK.find(d => d.id === activeDay)?.label}</h2>

                    <Dialog open={isAddingMode} onOpenChange={setIsAddingMode}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="gap-2">
                                <Plus size={16} /> Agregar
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Nuevo Ejercicio</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="name" className="text-right">
                                        Nombre
                                    </Label>
                                    <Input
                                        id="name"
                                        value={newExerciseName}
                                        onChange={(e) => setNewExerciseName(e.target.value)}
                                        className="col-span-3"
                                        placeholder="Ej. Press Banca"
                                        autoComplete="off"
                                    />
                                </div>
                            </div>
                            <Button onClick={handleCreateExercise} disabled={!newExerciseName.trim()}>
                                Guardar Ejercicio
                            </Button>
                        </DialogContent>
                    </Dialog>
                </div>

                {isLoading ? (
                    <p className="text-muted-foreground text-sm text-center py-8">Cargando...</p>
                ) : exercises === undefined || exercises.length === 0 ? (
                    <div className="text-center py-12 border border-dashed rounded-lg border-border">
                        <p className="text-muted-foreground text-sm">No hay ejercicios para hoy.</p>
                    </div>
                ) : (
                    exercises.map((ex) => (
                        <Card key={ex.id}>
                            <CardContent className="p-4 flex justify-between items-center">
                                <span className="font-medium">{ex.name}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:bg-destructive/10"
                                    onClick={() => ex.id && handleRemoveExerciseFromDay(ex.id)}
                                >
                                    <Trash2 size={18} />
                                </Button>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
