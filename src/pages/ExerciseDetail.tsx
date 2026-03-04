import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSupabaseQuery } from '../lib/useSupabaseQuery';
import { supabase } from '../lib/db';
import type { SetLog, WorkoutLog, Exercise } from '../lib/db';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { ArrowLeft, Camera, Plus, Trash2, Repeat, Info } from 'lucide-react';
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
    const [rir, setRir] = useState<number>(3);
    const [showRirInfo, setShowRirInfo] = useState(false);
    const [isUnilateral, setIsUnilateral] = useState(false);

    // Crop State
    const [selectedImageStr, setSelectedImageStr] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isCropModalOpen, setIsCropModalOpen] = useState(false);
    const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);

    // Get current date string (YYYY-MM-DD)
    const todayDate = new Date().toISOString().split('T')[0];

    const EQUIPMENT_OPTIONS = ['Mancuernas', 'Barra', 'Máquina', 'Polea', 'Peso Corporal', 'Otro'];

    // Check if there's an active equipment swap for today
    const getActiveSwap = () => {
        const swapKey = `treno_equip_swap_${todayDate}`;
        const swapsStr = localStorage.getItem(swapKey);
        if (!swapsStr) return null;
        const swaps = JSON.parse(swapsStr);
        return swaps[exerciseId] || null;
    };

    const activeEquipSwap = getActiveSwap();

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

    // Dynamically set default RIR based on existing sets
    useEffect(() => {
        if (!exercise) return;

        const totalSeriesObjetivo = exercise.target_sets || 3;
        const currentSetNum = (todayLog?.sets?.length || 0) + 1;
        const seriesRestantes = totalSeriesObjetivo - currentSetNum;

        // Si ya terminamos, por defecto RIR 0
        if (currentSetNum > totalSeriesObjetivo) {
            setRir(0);
            return;
        }

        // Si es la última serie o pasamos
        if (seriesRestantes === 0) {
            setRir(0);
        } else if (seriesRestantes === 1) {
            // Penúltima serie
            setRir(1);
        } else if (currentSetNum === 1) {
            // Primera serie
            setRir(totalSeriesObjetivo === 2 ? 1 : 2);
        } else {
            // Series intermedias
            setRir(2);
        }
    }, [todayLog?.sets?.length, exercise?.target_sets]);

    const handleEquipmentSwap = (newEquipment: string) => {
        const swapKey = `treno_equip_swap_${todayDate}`;
        const existingSwapsStr = localStorage.getItem(swapKey);
        const swaps: Record<number, string> = existingSwapsStr ? JSON.parse(existingSwapsStr) : {};
        swaps[exerciseId] = newEquipment;
        localStorage.setItem(swapKey, JSON.stringify(swaps));
        setIsSwapModalOpen(false);
        // Force re-render by navigating to same page
        navigate(`/exercise/${exerciseId}`, { replace: true });
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
        const swapKey = `treno_equip_swap_${todayDate}`;
        const swapsStr = localStorage.getItem(swapKey);
        if (!swapsStr) return;

        const swaps = JSON.parse(swapsStr);
        delete swaps[exerciseId];
        localStorage.setItem(swapKey, JSON.stringify(swaps));

        navigate(`/exercise/${exerciseId}`, { replace: true });
    };

    const handleDeletePhoto = async () => {
        const { error } = await supabase
            .from('exercises')
            .update({ photo_data: null })
            .eq('id', exerciseId);

        if (!error) refetchEx();
    };

    // Fatigue calculation helpers
    const getRirColor = (rirVal: number) => {
        if (rirVal >= 3) return { bg: 'bg-green-500', hover: 'hover:bg-green-600', border: 'border-green-500', text: 'text-green-500', cardBorder: 'border-green-500/40', cardBg: 'bg-green-500/5' };
        if (rirVal === 2) return { bg: 'bg-yellow-500', hover: 'hover:bg-yellow-600', border: 'border-yellow-500', text: 'text-yellow-500', cardBorder: 'border-yellow-500/40', cardBg: 'bg-yellow-500/5' };
        if (rirVal === 1) return { bg: 'bg-orange-500', hover: 'hover:bg-orange-600', border: 'border-orange-500', text: 'text-orange-500', cardBorder: 'border-orange-500/40', cardBg: 'bg-orange-500/5' };
        return { bg: 'bg-red-500', hover: 'hover:bg-red-600', border: 'border-red-500', text: 'text-red-500', cardBorder: 'border-red-500/40', cardBg: 'bg-red-500/5' };
    };

    const totalSeriesObjetivo = exercise?.target_sets || 3;

    const calculateFatigue = (sets: SetLog[]) => {
        const serieActual = sets.length;

        const fatigaAcumulada = sets.reduce((acc, s) => {
            const setRir = s.rir ?? 3;
            return acc + (4 - setRir) * s.reps;
        }, 0);

        const lastSet = sets[sets.length - 1];
        const lastRir = lastSet?.rir ?? 3;
        const lastReps = lastSet?.reps ?? 0;
        const lastWeight = lastSet?.weight ?? 0;
        const lastUnit = lastSet?.unit ?? 'kg';

        const pesoReducidoLeve = Math.round(lastWeight * 0.9 * 10) / 10;
        const pesoReducidoFuerte = Math.round(lastWeight * 0.8 * 10) / 10;
        const seriesRestantes = totalSeriesObjetivo - serieActual;

        // === FIN DEL EJERCICIO ===
        if (serieActual >= totalSeriesObjetivo) {
            if (lastRir > 0) {
                return {
                    valor: fatigaAcumulada, estado: 'Incompleto',
                    mensaje: 'Terminaste sin llegar al fallo (RIR > 0). Para progresar, debes exigir más en tu última serie.',
                    color: 'text-yellow-400', bgColor: 'border-yellow-500/30 bg-yellow-500/5'
                };
            }
            if (lastRir === 0 && lastReps >= 8) {
                return {
                    valor: fatigaAcumulada, estado: '¡Progresión!',
                    mensaje: '¡Ejecución de manual! Terminaste al fallo con buenas reps. PRÓXIMA SESIÓN: SUBE EL PESO.',
                    color: 'text-green-400', bgColor: 'border-green-500/30 bg-green-500/5'
                };
            }
            if (lastRir === 0 && lastReps < 6) {
                return {
                    valor: fatigaAcumulada, estado: 'Completado',
                    mensaje: 'Llegaste al fallo pero con pocas reps. PRÓXIMA SESIÓN: Mantén peso o recupérate mejor.',
                    color: 'text-blue-400', bgColor: 'border-blue-500/30 bg-blue-500/5'
                };
            }
            return {
                valor: fatigaAcumulada, estado: 'Completado',
                mensaje: 'Ejercicio finalizado. Estímulo alto conseguido.',
                color: 'text-green-400', bgColor: 'border-green-500/30 bg-green-500/5'
            };
        }

        // === PENÚLTIMA SERIE ===
        if (seriesRestantes === 1) {
            if (lastReps <= 5 && lastRir <= 1) {
                return {
                    valor: fatigaAcumulada, estado: 'Fatiga Alta',
                    mensaje: `Tus reps cayeron mucho (≤5). Baja a ${pesoReducidoFuerte} ${lastUnit} para sacar buenas reps al fallo en la última.`,
                    color: 'text-orange-400', bgColor: 'border-orange-500/30 bg-orange-500/5'
                };
            }
            if (lastRir > 1) {
                return {
                    valor: fatigaAcumulada, estado: 'Reserva Alta',
                    mensaje: 'Te queda mucha gasolina. En la última serie ve al fallo absoluto (RIR 0) con este peso.',
                    color: 'text-yellow-400', bgColor: 'border-yellow-500/30 bg-yellow-500/5'
                };
            }
            return {
                valor: fatigaAcumulada, estado: 'Óptimo',
                mensaje: 'Preparado para el gran final. Mantén el peso y da el 100% (RIR 0) en tu última serie.',
                color: 'text-green-400', bgColor: 'border-green-500/30 bg-green-500/5'
            };
        }

        // === PRIMERA SERIE ===
        if (serieActual === 1) {
            if (lastRir === 0) {
                return {
                    valor: fatigaAcumulada, estado: 'Fallo Prematuro',
                    mensaje: `¡Peligro! Llegar al fallo en la S1 arruinará tus próximas series. Baja a ${pesoReducidoLeve} ${lastUnit}.`,
                    color: 'text-red-400', bgColor: 'border-red-500/30 bg-red-500/5'
                };
            }
            if (lastRir === 1 && totalSeriesObjetivo > 2) {
                return {
                    valor: fatigaAcumulada, estado: 'Demasiado Intenso',
                    mensaje: 'RIR 1 es mucha fatiga tan pronto. Lo ideal es RIR 2-3. Mantén peso, pero tus reps caerán.',
                    color: 'text-orange-400', bgColor: 'border-orange-500/30 bg-orange-500/5'
                };
            }
            const obRir = totalSeriesObjetivo === 2 ? "1" : "2";
            return {
                valor: fatigaAcumulada, estado: 'Óptimo',
                mensaje: `¡Excelente inicio! Guardaste energía. Mantén el peso y busca RIR ${obRir} en tu siguiente serie.`,
                color: 'text-green-400', bgColor: 'border-green-500/30 bg-green-500/5'
            };
        }

        // === SERIES INTERMEDIAS ===
        if (lastRir === 0 && lastReps <= 5) {
            return {
                valor: fatigaAcumulada, estado: 'Carga Excesiva',
                mensaje: `¡Fallo crítico! El peso es muy alto. Baja drásticamente a ${pesoReducidoFuerte} ${lastUnit}.`,
                color: 'text-red-400', bgColor: 'border-red-500/30 bg-red-500/5'
            };
        }
        if (lastRir === 0) {
            return {
                valor: fatigaAcumulada, estado: 'Fallo Prematuro',
                mensaje: `Llegaste al fallo muy pronto. Haz un 'Back-off set' bajando a ${pesoReducidoLeve} ${lastUnit} para las próximas.`,
                color: 'text-orange-400', bgColor: 'border-orange-500/30 bg-orange-500/5'
            };
        }
        if (lastRir > 2) {
            return {
                valor: fatigaAcumulada, estado: 'Muy Ligero',
                mensaje: 'Estás muy lejos del fallo. Deberías apretar más en la siguiente (busca RIR 1).',
                color: 'text-blue-400', bgColor: 'border-blue-500/30 bg-blue-500/5'
            };
        }

        return {
            valor: fatigaAcumulada, estado: 'Óptimo',
            mensaje: 'Buen ritmo. Mantén carga. La fatiga empieza a pesar, busca acercarte más al fallo en la próxima.',
            color: 'text-green-400', bgColor: 'border-green-500/30 bg-green-500/5'
        };
    };

    const fatigue = todayLog?.sets?.length ? calculateFatigue(todayLog.sets) : null;

    const handleAddSet = async () => {
        if (!reps || !weight) return;

        const newSet: SetLog = {
            reps: Number(reps),
            weight: Number(weight),
            unit,
            rir,
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
        setRir(3);
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

    // Calcular RIR inicial para la advertencia
    const getInitialRirObjective = () => {
        const targetSets = exercise?.target_sets || 3;
        if (targetSets === 1) return "0 (Fallo técnico)";
        if (targetSets === 2) return "1";
        return "2";
    };

    return (
        <div className="flex flex-col min-h-full pb-20 bg-background">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                    <h1 className="text-xl font-bold truncate max-w-[200px]">
                        {exercise?.name}
                        {activeEquipSwap && (
                            <span className="text-xs text-primary font-normal ml-2">({activeEquipSwap})</span>
                        )}
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <Dialog open={isSwapModalOpen} onOpenChange={setIsSwapModalOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="icon" className="rounded-full shadow-sm">
                                <Repeat size={18} className="text-primary" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-sm w-[85vw] p-5 flex flex-col gap-5">
                            <DialogHeader>
                                <DialogTitle>Cambiar Variante</DialogTitle>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Equipo actual: <span className="font-semibold text-foreground">{activeEquipSwap || exercise?.equipment || 'Sin definir'}</span>
                                </p>
                                <p className="text-xs text-muted-foreground">Solo para hoy. Mañana vuelve a tu configuración original.</p>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-2">
                                {EQUIPMENT_OPTIONS
                                    .filter(eq => eq !== (exercise?.equipment || ''))
                                    .map((eq) => (
                                        <Button
                                            key={eq}
                                            variant={activeEquipSwap === eq ? 'default' : 'outline'}
                                            className="h-12 text-sm font-medium"
                                            onClick={() => handleEquipmentSwap(eq)}
                                        >
                                            {eq}
                                        </Button>
                                    ))
                                }
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
                {activeEquipSwap && (
                    <Card className="bg-primary/5 border-primary/20">
                        <CardContent className="p-3 flex items-center justify-between gap-3 text-sm">
                            <div className="flex items-center gap-2 text-primary font-medium">
                                <Repeat size={16} />
                                Hoy con <span className="font-bold">{activeEquipSwap}</span>
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
                            <span className="bg-primary/20 text-primary text-xs px-2 h-6 flex items-center justify-center rounded-full">
                                {todayLog?.sets?.length ?? 0}/{totalSeriesObjetivo}
                            </span>
                        </h2>
                    </div>

                    {!todayLog?.sets?.length ? (
                        <div className="flex flex-col gap-3">
                            <div className="text-center py-6 px-4 border border-dashed rounded-xl border-border/60 bg-muted/20">
                                <p className="text-muted-foreground text-sm">Aún no has registrado series hoy.</p>
                            </div>

                            <Card className="shadow-sm overflow-hidden rounded-xl border border-blue-500/30 bg-blue-500/5">
                                <CardContent className="px-4 py-3 flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">🎯</span>
                                        <span className="font-semibold text-sm text-blue-500">
                                            Objetivo Inicial
                                        </span>
                                    </div>
                                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                        <span className="text-base">💡</span>
                                        <span>Empezando ejercicio ({exercise.target_sets || 3} series totales). Para aguantar la fatiga, intenta alcanzar un <strong>RIR {getInitialRirObjective()}</strong> en esta primera serie.</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {todayLog.sets.map((set, idx) => {
                                const setRirVal = set.rir ?? 3;
                                const rirColors = getRirColor(setRirVal);
                                return (
                                    <div
                                        key={idx}
                                        className={`flex items-center justify-between p-4 rounded-xl border ${rirColors.cardBorder} ${rirColors.cardBg} shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300`}
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
                                                    <span className={`font-medium ${rirColors.text}`}>
                                                        RIR {setRirVal}
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
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Fatigue Display */}
                {fatigue && (
                    <Card className={`shadow-sm mt-2 overflow-hidden rounded-xl border ${fatigue.bgColor}`}>
                        <CardContent className="px-4 flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">🔥</span>
                                <span className="font-semibold text-sm">
                                    Fatiga Acumulada: <span className={`font-bold ${fatigue.color}`}>{fatigue.estado}</span>
                                </span>
                            </div>
                            <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                <span className="text-base">💡</span>
                                <span>Sugerencia: {fatigue.mensaje}</span>
                            </div>
                        </CardContent>
                    </Card>
                )}

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

                        {/* RIR Selector */}
                        <div className="flex flex-col gap-2">
                            <Label>RIR</Label>
                            <div className="grid grid-cols-4 gap-2">
                                {([3, 2, 1, 0] as const).map((rirOpt) => {
                                    const isSelected = rir === rirOpt;
                                    const colors = getRirColor(rirOpt);
                                    const selectedClass = isSelected
                                        ? `${colors.bg} ${colors.hover} text-white ${colors.border}`
                                        : '';
                                    return (
                                        <Button
                                            key={rirOpt}
                                            variant={isSelected ? 'default' : 'outline'}
                                            size="sm"
                                            className={`font-bold text-base ${selectedClass}`}
                                            onClick={() => setRir(rirOpt)}
                                        >
                                            {rirOpt}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* RIR Info Toggle */}
                        <div className="flex justify-end -mt-2">
                            <button
                                type="button"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all active:scale-95"
                                onClick={() => setShowRirInfo(!showRirInfo)}
                            >
                                <Info size={14} className={showRirInfo ? "text-primary" : ""} />
                                <span>¿Qué es RIR?</span>
                            </button>
                        </div>

                        {showRirInfo && (
                            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Repeticiones en Reserva</p>
                                <div className="flex items-start gap-3">
                                    <span className="w-3 h-3 mt-1 rounded-full bg-green-500 flex-shrink-0 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></span>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-foreground">RIR 3-4</span>
                                        <span className="text-muted-foreground leading-tight">Quedan 3-4 repeticiones en reserva (Lejos del fallo, ideal para calentar).</span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="w-3 h-3 mt-1 rounded-full bg-yellow-500 flex-shrink-0 shadow-[0_0_8px_rgba(234,179,8,0.4)]"></span>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-foreground">RIR 2</span>
                                        <span className="text-muted-foreground leading-tight">Quedan 2 repeticiones en reserva (Difícil pero controlable).</span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="w-3 h-3 mt-1 rounded-full bg-orange-500 flex-shrink-0 shadow-[0_0_8px_rgba(249,115,22,0.4)]"></span>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-foreground">RIR 1</span>
                                        <span className="text-muted-foreground leading-tight">Queda 1 repetición en reserva (A una repetición de fallar, límite seguro).</span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="w-3 h-3 mt-1 rounded-full bg-red-500 flex-shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.4)]"></span>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-foreground">RIR 0</span>
                                        <span className="text-muted-foreground leading-tight">Ninguna repetición en reserva (Fallo técnico, no podrías hacer ni una más con buena forma).</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-3 pt-3 border-t border-border/40">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isUnilateral}
                                    onChange={(e) => setIsUnilateral(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                            <span className="text-sm font-medium text-foreground cursor-pointer select-none" onClick={() => setIsUnilateral(!isUnilateral)}>
                                Ejercicio unilateral <span className="text-muted-foreground font-normal text-xs ml-1">(ej. a una mano)</span>
                            </span>
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

                {/* Mark as Completed button */}
                {todayLog?.sets?.length ? (
                    <Button
                        variant="outline"
                        className="w-full h-12 font-semibold text-green-500 border-green-500/40 hover:bg-green-500/10 hover:text-green-600 mt-2"
                        onClick={() => navigate('/')}
                    >
                        ✓ Completado — Volver a la lista
                    </Button>
                ) : null}

            </div>
        </div>
    );
}
