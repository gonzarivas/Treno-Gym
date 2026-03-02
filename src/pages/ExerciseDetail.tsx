import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSupabaseQuery } from '../lib/useSupabaseQuery';
import { supabase } from '../lib/db';
import type { SetLog, WorkoutLog, Exercise } from '../lib/db';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { ArrowLeft, Camera, Plus, Trash2, Repeat, Search } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogTrigger
} from '../components/ui/dialog';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';

const createImage = (url: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.addEventListener('load', () => resolve(image))
        image.addEventListener('error', (error) => reject(error))
        image.src = url
    })

async function getCroppedImg(
    imageSrc: string,
    pixelCrop: Area
): Promise<string | null> {
    const image = await createImage(imageSrc)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) return null

    // set canvas width to final desired crop size
    canvas.width = pixelCrop.width
    canvas.height = pixelCrop.height

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    )

    // As Base64 string
    return canvas.toDataURL('image/jpeg', 0.8)
}

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
    const [searchParams] = useState(new URLSearchParams(window.location.search));
    const swappedFromId = searchParams.get('swappedFrom');

    // Crop State
    const [selectedImageStr, setSelectedImageStr] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isCropModalOpen, setIsCropModalOpen] = useState(false);
    const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

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

    // Fetch all available exercises for the swap search
    const { data: allExercises } = useSupabaseQuery(
        async () => {
            const { data, error } = await supabase
                .from('exercises')
                .select('*')
                .order('name');
            if (error) throw error;
            return data as Exercise[];
        },
        []
    );

    const filteredExercises = allExercises?.filter(ex =>
        ex.name.toLowerCase().includes(searchTerm.toLowerCase()) && ex.id !== exerciseId
    ) || [];

    const handleSwapExercise = (variant: Exercise) => {
        if (!variant.id) return;

        const swapKey = `treno_swap_${todayDate}`;
        const existingSwapsStr = localStorage.getItem(swapKey);
        const swaps: Record<number, number> = existingSwapsStr ? JSON.parse(existingSwapsStr) : {};

        // exerciseId is the original ID (from routine)
        // variant.id is what we are using today
        swaps[exerciseId] = variant.id;

        localStorage.setItem(swapKey, JSON.stringify(swaps));

        // Navigate to the new exercise but keep context if needed
        navigate(`/exercise/${variant.id}?swappedFrom=${exerciseId}`, { replace: true });
        setIsSwapModalOpen(false);
    };

    const handleCreateAndSwap = async () => {
        if (!searchTerm.trim()) return;

        try {
            // Check if it exists first (case insensitive)
            const { data: existing } = await supabase
                .from('exercises')
                .select('*')
                .ilike('name', searchTerm.trim())
                .maybeSingle();

            let targetEx: Exercise;

            if (existing) {
                targetEx = existing as Exercise;
            } else {
                // Create new exercise
                const { data: created, error } = await supabase
                    .from('exercises')
                    .insert([{
                        name: searchTerm.trim(),
                        muscle_group: exercise?.muscle_group || null,
                        equipment: 'Otro' // Default for quick swap
                    }])
                    .select('*')
                    .single();

                if (error) throw error;
                targetEx = created as Exercise;
                refetchEx(); // Update list of all exercises
            }

            handleSwapExercise(targetEx);
        } catch (e) {
            console.error(e);
        }
    };

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            setSelectedImageStr(reader.result as string);
            setIsCropModalOpen(true);
        };
        reader.readAsDataURL(file);

        // Clear input so same file can be selected again
        e.target.value = '';
    };

    const handleCropComplete = (_croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    };

    const handleSaveCroppedImage = async () => {
        if (!selectedImageStr || !croppedAreaPixels) return;

        try {
            const croppedImageBase64 = await getCroppedImg(selectedImageStr, croppedAreaPixels);

            if (croppedImageBase64) {
                const { error } = await supabase
                    .from('exercises')
                    .update({ photo_data: croppedImageBase64 })
                    .eq('id', exerciseId);

                if (!error) refetchEx();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsCropModalOpen(false);
            setSelectedImageStr(null);
        }
    };

    const handleRevertSwap = () => {
        const swapKey = `treno_swap_${todayDate}`;
        const swapsStr = localStorage.getItem(swapKey);
        if (!swapsStr || !swappedFromId) return;

        const swaps = JSON.parse(swapsStr);
        delete swaps[swappedFromId];
        localStorage.setItem(swapKey, JSON.stringify(swaps));

        navigate(`/exercise/${swappedFromId}`, { replace: true });
    };

    const handleDeletePhoto = async () => {
        const { error } = await supabase
            .from('exercises')
            .update({ photo_data: null })
            .eq('id', exerciseId);

        if (!error) refetchEx();
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
        return (
            <div className="flex flex-col min-h-full pb-20 bg-background p-4 gap-6">
                <div className="flex items-center gap-3 py-2">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <Skeleton className="h-8 w-48 rounded-md" />
                </div>
                <Skeleton className="h-[200px] w-full rounded-xl" />
                <Skeleton className="h-8 w-32 rounded-md" />
                <Skeleton className="h-[76px] w-full rounded-xl" />
                <Skeleton className="h-[76px] w-full rounded-xl" />
            </div>
        );
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
                <div className="flex items-center gap-2">
                    <Dialog open={isSwapModalOpen} onOpenChange={(open) => {
                        setIsSwapModalOpen(open);
                        if (open && exercise) {
                            // Pre-fill search with a "clean" name to show variants
                            const cleanName = exercise.name
                                .replace(/máquina|machine|polea|pulley/gi, '')
                                .trim();
                            setSearchTerm(cleanName);
                        }
                    }}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="icon" className="rounded-full shadow-sm">
                                <Repeat size={18} className="text-primary" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md w-[90vw] p-4 flex flex-col gap-4">
                            <DialogHeader>
                                <DialogTitle>Sustituir Ejercicio</DialogTitle>
                            </DialogHeader>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                <Input
                                    placeholder="Buscar variante..."
                                    className="pl-9"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {searchTerm.trim().length > 0 && (
                                    <Button
                                        className="h-10 w-full mt-2 gap-2"
                                        onClick={handleCreateAndSwap}
                                    >
                                        <Plus size={16} /> Crear y usar "{searchTerm.trim()}"
                                    </Button>
                                )}
                            </div>
                            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                                {filteredExercises.length > 0 ? (
                                    filteredExercises.map((ex) => (
                                        <Card
                                            key={ex.id}
                                            className="hover:bg-muted/30 border-border/40 transition-colors"
                                        >
                                            <CardContent className="p-3 flex items-center justify-between gap-4">
                                                <div className="flex flex-col overflow-hidden">
                                                    <div className="font-medium text-sm truncate">{ex.name}</div>
                                                    <div className="text-xs text-muted-foreground truncate">{ex.muscle_group} • {ex.equipment}</div>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="shrink-0 text-xs font-semibold h-8"
                                                    onClick={() => handleSwapExercise(ex)}
                                                >
                                                    Seleccionar
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    ))
                                ) : (
                                    searchTerm.trim().length === 0 && (
                                        <p className="text-center text-sm text-muted-foreground py-10 italic">
                                            Busca un ejercicio existente o escribe uno nuevo para sustituir.
                                        </p>
                                    )
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                    <input
                        id="photo-upload-nav"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoSelect}
                    />
                    <label htmlFor="photo-upload-nav">
                        <Button variant="outline" size="icon" className="rounded-full shadow-sm cursor-pointer" asChild>
                            <span><Camera size={20} className="text-foreground" /></span>
                        </Button>
                    </label>

                    <Dialog open={isCropModalOpen} onOpenChange={setIsCropModalOpen}>
                        <DialogContent className="max-w-md w-[90vw] p-0 border-0 overflow-hidden bg-black/95 text-white">
                            <DialogHeader className="p-4 absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent">
                                <DialogTitle className="text-white drop-shadow-md">Ajustar Imagen</DialogTitle>
                            </DialogHeader>
                            <div className="relative w-full h-[60vh] sm:h-[400px]">
                                {selectedImageStr && (
                                    <Cropper
                                        image={selectedImageStr}
                                        crop={crop}
                                        zoom={zoom}
                                        aspect={16 / 9}
                                        onCropChange={setCrop}
                                        onZoomChange={setZoom}
                                        onCropComplete={handleCropComplete}
                                    />
                                )}
                            </div>
                            <DialogFooter className="p-4 absolute bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black/80 to-transparent sm:justify-between flex-row justify-between items-center">
                                <Button variant="ghost" className="text-white hover:bg-white/20" onClick={() => setIsCropModalOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button className="bg-primary hover:bg-primary/90" onClick={handleSaveCroppedImage}>
                                    Guardar
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="p-4 flex flex-col gap-6">
                {/* Photo Section */}
                {exercise?.photo_data && (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-border overflow-hidden relative group">
                        <img src={exercise.photo_data} alt={exercise?.name} className="w-full aspect-video object-cover" />
                        <div className="absolute top-2 right-2 opacity-90 transition-opacity">
                            <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full shadow-md hover:bg-red-600" onClick={handleDeletePhoto}>
                                <Trash2 size={14} />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Substitution Banner */}
                {swappedFromId && (
                    <Card className="bg-primary/5 border-primary/20">
                        <CardContent className="p-3 flex items-center justify-between gap-3 text-sm">
                            <div className="flex items-center gap-2 text-primary font-medium">
                                <Repeat size={16} />
                                Estas usando este ejercicio como variante hoy.
                            </div>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleRevertSwap}>
                                Revertir
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Today's Sets History */}
                <div className="flex flex-col gap-3">
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
                        <div className="text-center py-6 px-4 border border-dashed rounded-xl border-border/60 bg-muted/20">
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

                {/* Add Set Form */}
                <Card className="shadow-sm border-primary/20 bg-card/50 mt-4 overflow-hidden rounded-xl border">
                    <div className="bg-primary/5 px-4 py-3 border-b border-primary/10 flex items-center gap-2">
                        <Plus size={16} className="text-primary" />
                        <span className="font-semibold text-sm">Nueva Serie</span>
                    </div>
                    <CardContent className="pt-4 flex flex-col gap-4">
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
            </div>
        </div>
    );
}
