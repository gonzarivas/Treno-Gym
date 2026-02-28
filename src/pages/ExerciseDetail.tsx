import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSupabaseQuery } from '../lib/useSupabaseQuery';
import { supabase } from '../lib/db';
import type { SetLog, WorkoutLog, Exercise } from '../lib/db';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ArrowLeft, Camera, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../components/ui/select';

export default function ExerciseDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const exerciseId = Number(id);

    // Form State
    const [reps, setReps] = useState('');
    const [weight, setWeight] = useState('');
    const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
    const [feeling, setFeeling] = useState<'normal' | 'intensa' | 'fallo'>('normal');
    const [isUnilateral, setIsUnilateral] = useState(false);

    // Get current date string (YYYY-MM-DD)
    const todayDate = new Date().toISOString().split('T')[0];

    // Fetch Data
    const { data: exercise, isLoading: isExLoading, refetch: refetchEx } = useSupabaseQuery(
        async () => {
            const { data, error } = await supabase
                .from('exercises')
                .select('*')
                .eq('id', exerciseId)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            return data as Exercise | null;
        },
        [exerciseId]
    );

    const { data: todayLog, refetch: refetchLog } = useSupabaseQuery(
        async () => {
            const { data, error } = await supabase
                .from('workout_logs')
                .select('*')
                .eq('exercise_id', exerciseId)
                .eq('date', todayDate)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            return data as WorkoutLog | null;
        },
        [exerciseId, todayDate]
    );

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result as string;
            const { error } = await supabase
                .from('exercises')
                .update({ photo_data: base64String })
                .eq('id', exerciseId);

            if (!error) refetchEx();
        };
        reader.readAsDataURL(file);
    };

    const handleAddSet = async () => {
        if (!reps || !weight) return;

        const newSet: SetLog = {
            reps: Number(reps),
            weight: Number(weight),
            unit,
            feeling,
            isUnilateral
        };

        if (todayLog && todayLog.id) {
            const { error } = await supabase
                .from('workout_logs')
                .update({ sets: [...todayLog.sets, newSet] })
                .eq('id', todayLog.id);
            if (!error) refetchLog();
        } else {
            const { error } = await supabase
                .from('workout_logs')
                .insert([{
                    exercise_id: exerciseId,
                    date: todayDate,
                    sets: [newSet]
                }]);
            if (!error) refetchLog();
        }

        setReps('');
        setFeeling('normal');
    };

    const handleRemoveSet = async (indexToRemove: number) => {
        if (!todayLog || !todayLog.id) return;

        const updatedSets = todayLog.sets.filter((_: any, idx: number) => idx !== indexToRemove);
        const { error } = await supabase
            .from('workout_logs')
            .update({ sets: updatedSets })
            .eq('id', todayLog.id);

        if (!error) refetchLog();
    };

    if (isExLoading) {
        return <div className="p-4 pt-12 text-center text-muted-foreground">Cargando...</div>;
    }

    if (!exercise) {
        return (
            <div className="p-4 pt-12 flex flex-col items-center gap-4">
                <p className="text-muted-foreground">Ejercicio no encontrado.</p>
                <Button variant="outline" onClick={() => navigate(-1)}>Volver</Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-full pb-20 bg-background">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                    <h1 className="text-xl font-bold truncate max-w-[200px]">{exercise?.name}</h1>
                </div>
            </div>

            <div className="p-4 flex flex-col gap-6">
                {/* Photo Section */}
                <div className="flex flex-col items-center justify-center bg-muted/40 rounded-xl border border-border overflow-hidden relative min-h-[160px]">
                    {exercise?.photo_data ? (
                        <>
                            <img src={exercise.photo_data} alt={exercise?.name} className="w-full h-48 object-cover" />
                            <label
                                htmlFor="photo-upload"
                                className="absolute bottom-2 right-2 bg-background/80 p-2 rounded-full shadow-lg border border-border cursor-pointer active:scale-95 transition-transform"
                            >
                                <Camera size={20} className="text-foreground" />
                            </label>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-8 text-muted-foreground gap-2">
                            <ImageIcon size={32} />
                            <p className="text-sm font-medium">Añadir foto de la máquina</p>
                            <label htmlFor="photo-upload">
                                <Button variant="outline" size="sm" className="mt-2 cursor-pointer" asChild>
                                    <span>Subir o tomar foto</span>
                                </Button>
                            </label>
                        </div>
                    )}
                    <input
                        id="photo-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                    />
                </div>

                {/* Add Set Form */}
                <Card className="shadow-sm border-primary/20 bg-card/50">
                    <CardHeader className="pb-3 border-b border-border/50">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Plus size={18} className="text-primary" /> Nueva Serie
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 flex flex-col gap-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="weight">Peso</Label>
                                <div className="flex">
                                    <Input
                                        id="weight"
                                        type="number"
                                        inputMode="decimal"
                                        placeholder="0"
                                        value={weight}
                                        onChange={(e) => setWeight(e.target.value)}
                                        className="rounded-r-none focus-visible:ring-1 focus-visible:ring-primary border-r-0"
                                    />
                                    <Select value={unit} onValueChange={(v: 'kg' | 'lb') => setUnit(v)}>
                                        <SelectTrigger className="w-[70px] rounded-l-none border-l-0 bg-muted/30 focus:ring-1">
                                            <SelectValue placeholder="Kg" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="kg">kg</SelectItem>
                                            <SelectItem value="lb">lb</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="reps">Repeticiones</Label>
                                <Input
                                    id="reps"
                                    type="number"
                                    inputMode="numeric"
                                    placeholder="0"
                                    value={reps}
                                    onChange={(e) => setReps(e.target.value)}
                                    className="focus-visible:ring-1 focus-visible:ring-primary"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label>Sensación</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['normal', 'intensa', 'fallo'] as const).map((opt) => (
                                    <Button
                                        key={opt}
                                        variant={feeling === opt ? 'default' : 'outline'}
                                        size="sm"
                                        className={`capitalize ${feeling === opt && opt === 'fallo' ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : ''}`}
                                        onClick={() => setFeeling(opt)}
                                    >
                                        {opt}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center space-x-2 pt-1 border-t border-border/50">
                            <input
                                type="checkbox"
                                id="unilateral"
                                checked={isUnilateral}
                                onChange={(e) => setIsUnilateral(e.target.checked)}
                                className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4 bg-background"
                            />
                            <Label htmlFor="unilateral" className="font-normal cursor-pointer select-none">
                                Ejercicio unilateral (ej. a una mano)
                            </Label>
                        </div>

                        <Button
                            className="w-full mt-2 font-semibold h-12 text-md"
                            onClick={handleAddSet}
                            disabled={!reps || !weight}
                        >
                            Registrar Serie
                        </Button>
                    </CardContent>
                </Card>

                {/* Today's Sets History */}
                <div className="flex flex-col gap-3 mt-2">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="font-semibold text-lg flex items-center gap-2">
                            Series de Hoy
                            {todayLog?.sets?.length ? (
                                <span className="bg-primary/20 text-primary text-xs w-6 h-6 flex items-center justify-center rounded-full">
                                    {todayLog.sets.length}
                                </span>
                            ) : null}
                        </h2>
                    </div>

                    {!todayLog?.sets?.length ? (
                        <div className="text-center py-10 px-4 border border-dashed rounded-xl border-border/60 bg-muted/20">
                            <p className="text-muted-foreground text-sm">Aún no has registrado series hoy.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {todayLog.sets.map((set, idx) => (
                                <div
                                    key={idx}
                                    className={`flex items-center justify-between p-4 rounded-xl border ${set.feeling === 'fallo' ? 'border-destructive/40 bg-destructive/5' :
                                        set.feeling === 'intensa' ? 'border-orange-500/40 bg-orange-500/5' :
                                            'border-border bg-card'
                                        } shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col items-center justify-center w-8 h-8 rounded-full bg-background border border-border group font-bold text-sm text-muted-foreground">
                                            {idx + 1}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-lg leading-tight">
                                                {set.weight} {set.unit} <span className="text-muted-foreground mx-1 font-normal">×</span> {set.reps} reps
                                            </span>
                                            <div className="flex gap-2 text-xs mt-1">
                                                <span className={`capitalize font-medium ${set.feeling === 'fallo' ? 'text-destructive' :
                                                    set.feeling === 'intensa' ? 'text-orange-500' : 'text-green-500'
                                                    }`}>
                                                    {set.feeling}
                                                </span>
                                                {set.isUnilateral && (
                                                    <>
                                                        <span className="text-muted-foreground">•</span>
                                                        <span className="text-muted-foreground italic">Unilateral</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-2"
                                        onClick={() => handleRemoveSet(idx)}
                                    >
                                        <Trash2 size={18} />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
