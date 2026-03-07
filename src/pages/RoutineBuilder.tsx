import { useState, useMemo, useEffect, useRef } from 'react';
import { useSupabaseQuery } from '../lib/useSupabaseQuery';
import { supabase } from '../lib/db';
import type { Exercise, RoutineDay } from '../lib/db';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Plus, Trash2, Edit2, GripVertical } from 'lucide-react';
import { Reorder } from 'framer-motion';

const EQUIPMENT_OPTIONS = ['Mancuernas', 'Barra', 'Máquina', 'Polea', 'Peso Corporal', 'Otro'];
const MUSCLE_GROUPS = ['Pectoral', 'Espalda', 'Deltoides', 'Bíceps', 'Tríceps', 'Piernas', 'Glúteos', 'Abdomen', 'Cardio'];

const CLASSIC_EXERCISES = [
    { name: 'Press Banca', muscle: 'Pectoral', equip: 'Barra' },
    { name: 'Press Inclinado', muscle: 'Pectoral', equip: 'Mancuernas' },
    { name: 'Aperturas', muscle: 'Pectoral', equip: 'Polea' },
    { name: 'Dominadas', muscle: 'Espalda', equip: 'Peso Corporal' },
    { name: 'Remo con Barra', muscle: 'Espalda', equip: 'Barra' },
    { name: 'Jalón al Pecho', muscle: 'Espalda', equip: 'Máquina' },
    { name: 'Press Militar', muscle: 'Deltoides', equip: 'Barra' },
    { name: 'Elevaciones Laterales', muscle: 'Deltoides', equip: 'Mancuernas' },
    { name: 'Curl Bayesiano', muscle: 'Bíceps', equip: 'Polea' },
    { name: 'Curl con Barra', muscle: 'Bíceps', equip: 'Barra' },
    { name: 'Extensiones de Tríceps', muscle: 'Tríceps', equip: 'Polea' },
    { name: 'Sentadilla', muscle: 'Piernas', equip: 'Barra' },
    { name: 'Prensa', muscle: 'Piernas', equip: 'Máquina' },
    { name: 'Peso Muerto', muscle: 'Piernas', equip: 'Barra' },
    { name: 'Extensión de Cuádriceps', muscle: 'Piernas', equip: 'Máquina' },
    { name: 'Curl Femoral', muscle: 'Piernas', equip: 'Máquina' },
    { name: 'Hip Thrust', muscle: 'Glúteos', equip: 'Barra' },
];

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
    const [activeDay, setActiveDay] = useState(() => new Date().getDay()); // Default to today
    const [isAddingMode, setIsAddingMode] = useState(false);
    const [newExerciseName, setNewExerciseName] = useState('');
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [newExerciseEquip, setNewExerciseEquip] = useState('');
    const [newExerciseMuscle, setNewExerciseMuscle] = useState('');
    const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
    const [newExerciseSets, setNewExerciseSets] = useState<number>(3);

    // Edit State
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
    const [editName, setEditName] = useState('');
    const [editMuscle, setEditMuscle] = useState('');
    const [editEquip, setEditEquip] = useState('');
    const [editSets, setEditSets] = useState(3);

    // Drag and Drop state
    const [localExerciseIds, setLocalExerciseIds] = useState<number[]>([]);

    // Ref for auto-scrolling active day tab into view
    const activeDayRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        activeDayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, []);
    // Fetch Routine Day
    const { data: routineDay, isLoading: isRoutineDayLoading, refetch: refetchRoutineDay } = useSupabaseQuery(
        async () => {
            const { data, error } = await supabase
                .from('routine_days')
                .select('*')
                .eq('day_of_week', activeDay)
                .single();
            if (error && error.code !== 'PGRST116') throw error; // PGRST116 means no rows found

            const dayData = data as RoutineDay | null;
            if (dayData?.exercise_ids) {
                setLocalExerciseIds(dayData.exercise_ids);
            } else {
                setLocalExerciseIds([]);
            }

            return dayData;
        },
        [activeDay]
    );

    // Fetch all unique exercise names from DB for suggestions
    const { data: dbExerciseSuggestions } = useSupabaseQuery(
        async () => {
            const { data, error } = await supabase
                .from('exercises')
                .select('name, muscle_group, equipment')
                .order('name');
            if (error) throw error;

            // Filter unique by name
            const unique = new Map();
            data?.forEach(ex => {
                if (!unique.has(ex.name.toLowerCase())) {
                    unique.set(ex.name.toLowerCase(), {
                        name: ex.name,
                        muscle: ex.muscle_group,
                        equip: ex.equipment
                    });
                }
            });
            return Array.from(unique.values());
        },
        []
    );

    const allSuggestions = useMemo(() => {
        const combined = [...CLASSIC_EXERCISES];
        const existingNames = new Set(combined.map(ex => ex.name.toLowerCase()));

        dbExerciseSuggestions?.forEach(ex => {
            if (!existingNames.has(ex.name.toLowerCase())) {
                combined.push(ex);
                existingNames.add(ex.name.toLowerCase());
            }
        });

        return combined.sort((a, b) => a.name.localeCompare(b.name));
    }, [dbExerciseSuggestions]);

    // Fetch Exercises for this day, maintaining the order from routineDay.exercise_ids
    const { data: exercises, isLoading: isExercisesLoading } = useSupabaseQuery(
        async () => {
            if (!routineDay || !routineDay.exercise_ids || !routineDay.exercise_ids.length) return [];
            const { data, error } = await supabase
                .from('exercises')
                .select('*')
                .in('id', routineDay.exercise_ids);
            if (error) throw error;

            const exArray = data as Exercise[];
            // Maintain exact order from exercise_ids array
            return routineDay.exercise_ids
                .map(id => exArray.find(e => e.id === id))
                .filter(Boolean) as Exercise[];
        },
        [routineDay]
    );



    const handleCreateExercise = async () => {
        if (!newExerciseName.trim()) return;

        try {
            // 1. Check if exercise already exists
            const { data: existingEx, error: checkError } = await supabase
                .from('exercises')
                .select('id')
                .ilike('name', newExerciseName.trim())
                .limit(1);

            if (checkError) throw checkError;

            let exerciseId;

            if (existingEx && existingEx.length > 0) {
                exerciseId = existingEx[0].id;
                // Update target sets of existing exercise if it's being added again to the routine
                await supabase.from('exercises').update({ target_sets: newExerciseSets }).eq('id', exerciseId);
            } else {
                // Create the exercise
                const { data: exData, error: exError } = await supabase
                    .from('exercises')
                    .insert([{
                        name: newExerciseName.trim(),
                        muscle_group: newExerciseMuscle || null,
                        equipment: newExerciseEquip || null,
                        target_sets: newExerciseSets
                    }])
                    .select('id')
                    .single();

                if (exError) throw exError;
                exerciseId = exData.id;
            }

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
            setNewExerciseMuscle('');
            setNewExerciseEquip('');
            setNewExerciseSets(3);
            setIsAddingMode(false);

            // Optimistically update local IDs
            setLocalExerciseIds(prev => [...prev, exerciseId]);

            refetchRoutineDay(); // Refetch routine day to get updated exercise_ids
        } catch (e) {
            console.error(e);
        }
    };

    const handleUpdateExercise = async () => {
        if (!editingExercise || !editName.trim()) return;

        try {
            const { error } = await supabase
                .from('exercises')
                .update({
                    name: editName.trim(),
                    muscle_group: editMuscle || null,
                    equipment: editEquip || null,
                    target_sets: editSets
                })
                .eq('id', editingExercise.id);

            if (error) throw error;

            setIsEditMode(false);
            setEditingExercise(null);
            refetchRoutineDay(); // Trigger refetch
        } catch (e) {
            console.error(e);
        }
    };

    const handleReorder = async (newIds: number[]) => {
        setLocalExerciseIds(newIds);

        if (!routineDay || routineDay.id === undefined) return;

        try {
            const { error } = await supabase
                .from('routine_days')
                .update({ exercise_ids: newIds })
                .eq('id', routineDay.id);

            if (error) throw error;
        } catch (e) {
            console.error('Error saving new order:', e);
        }
    };

    const handleRemoveExerciseFromDay = async (exerciseId: number) => {
        if (!routineDay || routineDay.id === undefined) return;

        try {
            const newIds = localExerciseIds.filter(id => id !== exerciseId);
            setLocalExerciseIds(newIds);

            // Update routine_days to remove the exercise from this day ONLY
            const { error } = await supabase
                .from('routine_days')
                .update({
                    exercise_ids: newIds
                })
                .eq('id', routineDay.id);

            if (error) throw error;
            refetchRoutineDay(); // Refetch routine day to get updated exercise_ids
        } catch (e) {
            console.error(e);
        }
    };

    const isLoading = isRoutineDayLoading || isExercisesLoading ||
        (routineDay && routineDay.exercise_ids?.length > 0 && exercises === undefined);

    return (
        <div className="p-4 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold">Rutina Semanal</h1>
                <p className="text-muted-foreground text-sm">Selecciona un día para organizar tus ejercicios.</p>
            </div>

            {/* Days Tabs */}
            <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
                {DAYS_OF_WEEK.map((day) => {
                    const isActive = activeDay === day.id;
                    return (
                        <Button
                            key={day.id}
                            ref={isActive ? activeDayRef : undefined}
                            variant={isActive ? 'default' : 'outline'}
                            className="min-w-fit rounded-full"
                            onClick={() => setActiveDay(day.id)}
                        >
                            {day.label}
                        </Button>
                    );
                })}
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
                                <div className="grid grid-cols-4 items-start gap-4">
                                    <Label htmlFor="name" className="text-right mt-3">
                                        Nombre
                                    </Label>
                                    <div className="col-span-3 relative">
                                        <Input
                                            id="name"
                                            value={newExerciseName}
                                            onFocus={() => setShowAutocomplete(true)}
                                            onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setNewExerciseName(val);
                                                setShowAutocomplete(true);
                                                // Auto-fill equipment and muscle if match exactly
                                                const match = allSuggestions.find(ex => ex.name.toLowerCase() === val.toLowerCase());
                                                if (match) {
                                                    if (match.muscle) setNewExerciseMuscle(match.muscle);
                                                    if (match.equip) setNewExerciseEquip(match.equip);
                                                }
                                            }}
                                            placeholder="Ej. Press Banca"
                                            autoComplete="off"
                                        />

                                        {/* Custom Autocomplete Dropdown */}
                                        {showAutocomplete && newExerciseName.trim().length > 0 && (
                                            <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground border border-border rounded-md shadow-md max-h-[150px] overflow-y-auto">
                                                {allSuggestions.filter(ex => ex.name.toLowerCase().includes(newExerciseName.toLowerCase())).length > 0 ? (
                                                    allSuggestions.filter(ex => ex.name.toLowerCase().includes(newExerciseName.toLowerCase())).map((ex) => (
                                                        <div
                                                            key={ex.name}
                                                            className="px-3 py-2 text-sm cursor-pointer hover:bg-muted"
                                                            onClick={() => {
                                                                setNewExerciseName(ex.name);
                                                                if (ex.muscle) setNewExerciseMuscle(ex.muscle);
                                                                if (ex.equip) setNewExerciseEquip(ex.equip);
                                                                setShowAutocomplete(false);
                                                            }}
                                                        >
                                                            <div className="font-medium">{ex.name}</div>
                                                            <div className="text-xs text-muted-foreground">{ex.muscle || '—'} • {ex.equip || '—'}</div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="px-3 py-2 text-sm text-muted-foreground italic">
                                                        No hay coincidencias
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">Músculo</Label>
                                    <div className="col-span-3">
                                        <Select value={newExerciseMuscle} onValueChange={setNewExerciseMuscle}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Opcional" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {MUSCLE_GROUPS.map(m => (
                                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">Equipo</Label>
                                    <div className="col-span-3">
                                        <Select value={newExerciseEquip} onValueChange={setNewExerciseEquip}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Opcional" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {EQUIPMENT_OPTIONS.map(eq => (
                                                    <SelectItem key={eq} value={eq}>{eq}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">Series</Label>
                                    <div className="col-span-3 flex flex-col gap-1">
                                        <Select value={newExerciseSets.toString()} onValueChange={(v) => setNewExerciseSets(Number(v))}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[1, 2, 3, 4, 5, 6].map(num => (
                                                    <SelectItem key={num} value={num.toString()}>{num} {num === 1 ? 'Serie' : 'Series'}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {newExerciseSets > 1 && (
                                            <p className="text-[11px] text-muted-foreground mt-1 leading-tight">
                                                Estrategia RIR: {
                                                    newExerciseSets === 2 ? "S1: RIR 1 → S2: RIR 0" :
                                                        newExerciseSets === 3 ? "S1: RIR 2 → S2: RIR 1 → S3: RIR 0" :
                                                            newExerciseSets === 4 ? "S1-S2: RIR 2 → S3: RIR 1 → S4: RIR 0" :
                                                                "Conservar RIR 2-3 inicial, terminar en RIR 0"
                                                }
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <Button onClick={handleCreateExercise} disabled={!newExerciseName.trim()}>
                                Guardar Ejercicio
                            </Button>
                        </DialogContent>
                    </Dialog>
                </div>

                {isLoading ? (
                    <div className="flex flex-col gap-3 py-2">
                        <Skeleton className="h-[68px] w-full rounded-xl" />
                        <Skeleton className="h-[68px] w-full rounded-xl" />
                        <Skeleton className="h-[68px] w-full rounded-xl" />
                    </div>
                ) : exercises === undefined || exercises.length === 0 ? (
                    <div className="text-center py-12 border border-dashed rounded-lg border-border">
                        <p className="text-muted-foreground text-sm">No hay ejercicios para hoy.</p>
                    </div>
                ) : (
                    <Reorder.Group axis="y" values={localExerciseIds} onReorder={handleReorder} className="flex flex-col gap-4">
                        {localExerciseIds.map((id, index) => {
                            const ex = exercises.find(e => e.id === id);
                            if (!ex) return null;

                            // Check if this is the first item of a new muscle group block
                            const muscle = ex.muscle_group || 'Otros';
                            const prevEx = index > 0 ? exercises.find(e => e.id === localExerciseIds[index - 1]) : null;
                            const isNewGroup = !prevEx || (prevEx.muscle_group || 'Otros') !== muscle;

                            return (
                                <div key={ex.id} className="flex flex-col gap-2">
                                    {isNewGroup && (
                                        <span className="text-[10px] uppercase font-bold tracking-widest text-primary ml-1 mt-2">
                                            {muscle}
                                        </span>
                                    )}
                                    <Reorder.Item
                                        value={id}
                                        id={id.toString()}
                                        className="list-none"
                                    >
                                        <Card className="overflow-hidden border-border/40 shadow-none active:scale-[0.98] active:shadow-md transition-all">
                                            <CardContent className="p-3 flex justify-between items-center bg-card">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    {/* Drag Handle */}
                                                    <div className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground/40 hover:text-primary transition-colors">
                                                        <GripVertical size={20} />
                                                    </div>

                                                    <div className="flex flex-col min-w-0">
                                                        <span className="font-bold text-sm truncate leading-tight">{ex.name}</span>
                                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5 font-medium">
                                                            {ex.equipment && (
                                                                <span className="bg-muted px-1.5 py-0.5 rounded italic">
                                                                    {ex.equipment}
                                                                </span>
                                                            )}
                                                            <span className="tabular-nums font-bold text-primary/80">
                                                                {ex.target_sets} sets
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingExercise(ex);
                                                            setEditName(ex.name);
                                                            setEditMuscle(ex.muscle_group || '');
                                                            setEditEquip(ex.equipment || '');
                                                            setEditSets(ex.target_sets || 3);
                                                            setIsEditMode(true);
                                                        }}
                                                    >
                                                        <Edit2 size={16} />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            ex.id && setPendingDeleteId(ex.id);
                                                        }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Reorder.Item>
                                </div>
                            );
                        })}
                    </Reorder.Group>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Quitar de este día?</AlertDialogTitle>
                        <AlertDialogDescription>
                            El ejercicio se eliminará de tu rutina de hoy, pero seguirá existiendo en otros días y en tu historial.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={() => {
                                if (pendingDeleteId) {
                                    handleRemoveExerciseFromDay(pendingDeleteId);
                                }
                                setPendingDeleteId(null);
                            }}
                        >
                            Confirmar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Edit Exercise Dialog */}
            <Dialog open={isEditMode} onOpenChange={setIsEditMode}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Editar Ejercicio</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-name" className="text-right">Nombre</Label>
                            <Input
                                id="edit-name"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Músculo</Label>
                            <div className="col-span-3">
                                <Select value={editMuscle} onValueChange={setEditMuscle}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Opcional" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MUSCLE_GROUPS.map(m => (
                                            <SelectItem key={m} value={m}>{m}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Equipo</Label>
                            <div className="col-span-3">
                                <Select value={editEquip} onValueChange={setEditEquip}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Opcional" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {EQUIPMENT_OPTIONS.map(eq => (
                                            <SelectItem key={eq} value={eq}>{eq}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Series</Label>
                            <div className="col-span-3">
                                <Select value={editSets.toString()} onValueChange={(v) => setEditSets(Number(v))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[1, 2, 3, 4, 5, 6].map(num => (
                                            <SelectItem key={num} value={num.toString()}>{num} {num === 1 ? 'Serie' : 'Series'}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <Button onClick={handleUpdateExercise} disabled={!editName.trim()}>
                        Guardar Cambios
                    </Button>
                </DialogContent>
            </Dialog>
        </div>
    );
}
