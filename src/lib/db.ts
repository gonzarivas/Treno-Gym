import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.warn("Faltan las variables de entorno de Supabase en .env.local");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface Exercise {
    id?: number;
    name: string;
    notes?: string;
    photo_data?: string; // supabase uses snake_case natively or we map it
    muscle_group?: string;
    equipment?: string;
    target_sets?: number;
}

export interface SetLog {
    reps: number;
    weight: number;
    unit: 'kg' | 'lb';
    feeling?: 'normal' | 'intensa' | 'fallo';
    rir: number;
    isUnilateral: boolean;
}

export interface WorkoutLog {
    id?: number;
    exercise_id: number;
    date: string; // YYYY-MM-DD format
    sets: SetLog[];
}

export interface RoutineDay {
    id?: number;
    day_of_week: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    exercise_ids: number[]; // Ordered array of exercise IDs
}
