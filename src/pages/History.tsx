import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useSupabaseQuery } from '../lib/useSupabaseQuery';
import { supabase } from '../lib/db';
import type { Exercise, WorkoutLog, SetLog } from '../lib/db';
import { Skeleton } from '../components/ui/skeleton';
import { ChevronLeft, ChevronRight, Flame, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function getMonthDays(year: number, month: number) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // getDay() returns 0=Sunday. We want Monday=0
    let startWeekday = firstDay.getDay() - 1;
    if (startWeekday < 0) startWeekday = 6;

    const days: (number | null)[] = [];
    // Add empty cells before first day
    for (let i = 0; i < startWeekday; i++) {
        days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
        days.push(d);
    }
    return days;
}

function formatDateStr(year: number, month: number, day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getFeelingEmoji(feeling?: string) {
    if (feeling === 'intensa') return '🔥';
    if (feeling === 'fallo') return '💀';
    return '';
}

export default function History() {
    const today = useMemo(() => new Date(), []);
    const todayStr = useMemo(() => today.toISOString().split('T')[0], [today]);

    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);

    // Navigate months
    const goToPrevMonth = useCallback(() => {
        setSelectedDate(null);
        setViewMonth(prev => {
            if (prev === 0) {
                setViewYear(y => y - 1);
                return 11;
            }
            return prev - 1;
        });
    }, []);

    const goToNextMonth = useCallback(() => {
        setSelectedDate(null);
        setViewMonth(prev => {
            if (prev === 11) {
                setViewYear(y => y + 1);
                return 0;
            }
            return prev + 1;
        });
    }, []);

    const goToToday = useCallback(() => {
        setViewYear(today.getFullYear());
        setViewMonth(today.getMonth());
        setSelectedDate(null);
    }, [today]);

    // Fetch all workout logs for the visible month
    const monthStart = formatDateStr(viewYear, viewMonth, 1);
    const monthEnd = formatDateStr(viewYear, viewMonth, new Date(viewYear, viewMonth + 1, 0).getDate());

    const { data: monthLogs, isLoading: isLogsLoading } = useSupabaseQuery(
        async () => {
            const { data, error } = await supabase
                .from('workout_logs')
                .select('*')
                .gte('date', monthStart)
                .lte('date', monthEnd)
                .order('date', { ascending: true });

            if (error) throw error;
            return data as WorkoutLog[];
        },
        [monthStart, monthEnd]
    );

    // Build a set of dates that have workouts
    const workoutDatesMap = useMemo(() => {
        const map = new Map<string, WorkoutLog[]>();
        if (!monthLogs) return map;
        for (const log of monthLogs) {
            if (!log.sets || log.sets.length === 0) continue;
            const dateStr = log.date;
            if (!map.has(dateStr)) {
                map.set(dateStr, []);
            }
            map.get(dateStr)!.push(log);
        }
        return map;
    }, [monthLogs]);

    // Fetch exercises for the selected date's logs
    const selectedLogs = selectedDate ? workoutDatesMap.get(selectedDate) || [] : [];
    const selectedExerciseIds = useMemo(
        () => [...new Set(selectedLogs.map(l => l.exercise_id))],
        [selectedLogs]
    );

    const { data: selectedExercises, isLoading: isExercisesLoading } = useSupabaseQuery(
        async () => {
            if (selectedExerciseIds.length === 0) return [];
            const { data, error } = await supabase
                .from('exercises')
                .select('*')
                .in('id', selectedExerciseIds);
            if (error) throw error;
            return data as Exercise[];
        },
        [selectedExerciseIds.join(',')]
    );

    const exerciseMap = useMemo(() => {
        const map = new Map<number, Exercise>();
        if (selectedExercises) {
            for (const ex of selectedExercises) {
                if (ex.id) map.set(ex.id, ex);
            }
        }
        return map;
    }, [selectedExercises]);

    // Scroll to top on month change
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, [viewYear, viewMonth]);

    const monthDays = getMonthDays(viewYear, viewMonth);

    // Count total sets for a workout day (for ring intensity)
    const getDayIntensity = (dateStr: string) => {
        const logs = workoutDatesMap.get(dateStr);
        if (!logs) return 0;
        const totalSets = logs.reduce((acc, l) => acc + (l.sets?.length || 0), 0);
        if (totalSets >= 15) return 3; // full ring
        if (totalSets >= 8) return 2; // 2/3 ring
        return 1; // partial ring
    };

    const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

    return (
        <div className="flex flex-col h-full overflow-y-auto" ref={scrollRef}>
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50">
                <div className="flex items-center justify-between px-4 py-3">
                    <button
                        onClick={goToPrevMonth}
                        className="p-1.5 rounded-lg hover:bg-muted active:scale-95 transition-all text-muted-foreground"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <button
                        onClick={goToToday}
                        className="flex flex-col items-center"
                    >
                        <span className="text-lg font-bold tracking-tight">
                            {MONTH_NAMES[viewMonth]} {viewYear}
                        </span>
                        {!isCurrentMonth && (
                            <span className="text-[10px] text-primary font-medium">
                                Ir a hoy
                            </span>
                        )}
                    </button>

                    <button
                        onClick={goToNextMonth}
                        className="p-1.5 rounded-lg hover:bg-muted active:scale-95 transition-all text-muted-foreground"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 px-2 pb-2">
                    {WEEKDAY_LABELS.map((label, i) => (
                        <div key={i} className="text-center text-[11px] font-semibold text-muted-foreground">
                            {label}
                        </div>
                    ))}
                </div>
            </div>

            {/* Calendar grid */}
            <div className="flex-1 px-2 pt-1 pb-24">
                {isLogsLoading ? (
                    <div className="grid grid-cols-7 gap-1 py-2">
                        {Array.from({ length: 35 }).map((_, i) => (
                            <div key={i} className="flex items-center justify-center py-1">
                                <Skeleton className="w-10 h-10 rounded-full" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-7 gap-0">
                        {monthDays.map((day, i) => {
                            if (day === null) {
                                return <div key={`empty-${i}`} className="aspect-square" />;
                            }

                            const dateStr = formatDateStr(viewYear, viewMonth, day);
                            const isToday = dateStr === todayStr;
                            const hasWorkout = workoutDatesMap.has(dateStr);
                            const isSelected = dateStr === selectedDate;
                            const intensity = getDayIntensity(dateStr);
                            const isFuture = new Date(dateStr) > today;

                            return (
                                <button
                                    key={dateStr}
                                    onClick={() => {
                                        if (hasWorkout) {
                                            setSelectedDate(isSelected ? null : dateStr);
                                        }
                                    }}
                                    disabled={isFuture}
                                    className={`
                                        aspect-square flex items-center justify-center relative
                                        transition-all duration-200
                                        ${isFuture ? 'opacity-30' : ''}
                                    `}
                                >
                                    {/* Activity ring */}
                                    {hasWorkout && (
                                        <div className="absolute inset-1">
                                            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                                {/* Background ring */}
                                                <circle
                                                    cx="18" cy="18" r="15.5"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="3"
                                                    className="text-primary/15"
                                                />
                                                {/* Active ring */}
                                                <circle
                                                    cx="18" cy="18" r="15.5"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="3"
                                                    strokeLinecap="round"
                                                    strokeDasharray={`${(intensity / 3) * 97.4} 97.4`}
                                                    className="text-primary"
                                                    style={{
                                                        filter: 'drop-shadow(0 0 3px hsl(var(--primary) / 0.4))',
                                                    }}
                                                />
                                            </svg>
                                        </div>
                                    )}

                                    {/* Day number */}
                                    <span
                                        className={`
                                            relative z-10 text-sm font-medium
                                            w-7 h-7 flex items-center justify-center rounded-full
                                            transition-all duration-200
                                            ${isToday
                                                ? 'bg-primary text-primary-foreground font-bold'
                                                : isSelected
                                                    ? 'bg-muted text-foreground font-bold'
                                                    : hasWorkout
                                                        ? 'text-foreground'
                                                        : 'text-muted-foreground'
                                            }
                                        `}
                                    >
                                        {day}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Selected day detail panel */}
                <AnimatePresence mode="wait">
                    {selectedDate && selectedLogs.length > 0 && (
                        <motion.div
                            key={selectedDate}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="mt-4 rounded-2xl bg-card border border-border/60 overflow-hidden"
                        >
                            {/* Detail header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                                <div className="flex items-center gap-2">
                                    <Flame size={16} className="text-primary" />
                                    <span className="font-semibold text-sm">
                                        {(() => {
                                            const d = new Date(selectedDate + 'T12:00:00');
                                            return d.toLocaleDateString('es-ES', {
                                                weekday: 'long',
                                                day: 'numeric',
                                                month: 'long',
                                            });
                                        })()}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setSelectedDate(null)}
                                    className="p-1 rounded-md hover:bg-muted transition-colors"
                                >
                                    <X size={16} className="text-muted-foreground" />
                                </button>
                            </div>

                            {/* Exercise list */}
                            <div className="divide-y divide-border/30">
                                {isExercisesLoading ? (
                                    <div className="p-4 flex flex-col gap-3">
                                        <Skeleton className="h-10 w-full rounded-lg" />
                                        <Skeleton className="h-10 w-full rounded-lg" />
                                    </div>
                                ) : (
                                    selectedLogs.map((log, idx) => {
                                        const ex = exerciseMap.get(log.exercise_id);
                                        if (!ex) return null;

                                        const sets = log.sets || [];
                                        const totalSets = sets.length;
                                        const maxWeight = Math.max(...sets.map((s: SetLog) => s.weight), 0);

                                        return (
                                            <div key={log.id || idx} className="px-4 py-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-medium text-sm truncate">
                                                            {ex.name}
                                                        </h4>
                                                        {ex.equipment && (
                                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                                                {ex.equipment}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <span className="text-xs font-bold text-primary tabular-nums">
                                                            {totalSets} {totalSets === 1 ? 'serie' : 'series'}
                                                        </span>
                                                        {maxWeight > 0 && (
                                                            <p className="text-[10px] text-muted-foreground">
                                                                Máx: {maxWeight}{sets[0]?.unit || 'kg'}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Sets detail */}
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {sets.map((set: SetLog, sIdx: number) => (
                                                        <span
                                                            key={sIdx}
                                                            className={`
                                                                text-[10px] px-2 py-0.5 rounded-full font-medium tabular-nums
                                                                ${set.feeling === 'fallo'
                                                                    ? 'bg-destructive/15 text-destructive'
                                                                    : set.feeling === 'intensa'
                                                                        ? 'bg-amber-500/15 text-amber-500'
                                                                        : 'bg-muted text-muted-foreground'
                                                                }
                                                            `}
                                                        >
                                                            {set.weight}{set.unit} × {set.reps}
                                                            {getFeelingEmoji(set.feeling)}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Summary footer */}
                            <div className="px-4 py-2.5 bg-muted/30 border-t border-border/40 flex items-center justify-between">
                                <span className="text-[11px] text-muted-foreground">
                                    {selectedLogs.length} {selectedLogs.length === 1 ? 'ejercicio' : 'ejercicios'}
                                </span>
                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                    {selectedLogs.reduce((acc, l) => acc + (l.sets?.length || 0), 0)} series totales
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Empty state for selected day without workout */}
                {selectedDate && workoutDatesMap.has(selectedDate) === false && (
                    <div className="mt-4 py-8 text-center text-muted-foreground text-sm">
                        No hay entrenamientos registrados este día.
                    </div>
                )}

                {/* Monthly summary */}
                {!selectedDate && !isLogsLoading && (
                    <div className="mt-6 px-2">
                        <div className="rounded-2xl bg-card border border-border/60 p-4">
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <Flame size={14} className="text-primary" />
                                Resumen del mes
                            </h3>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-primary tabular-nums">
                                        {workoutDatesMap.size}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        Días activos
                                    </p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-foreground tabular-nums">
                                        {monthLogs?.reduce((acc, l) => acc + (l.sets?.length || 0), 0) || 0}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        Series totales
                                    </p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-foreground tabular-nums">
                                        {monthLogs?.length || 0}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        Ejercicios
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
