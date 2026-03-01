-- Cuidado: Ejecutar esto creará las tablas necesarias para TrenoGym.

-- 1. Tabla de Ejercicios
CREATE TABLE exercises (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    notes TEXT,
    photo_data TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Tabla de Días de Rutina (Relaciona el día de la semana con los ejercicios)
CREATE TABLE routine_days (
    id SERIAL PRIMARY KEY,
    day_of_week INTEGER NOT NULL UNIQUE, -- 0 (Domingo) a 6 (Sábado)
    exercise_ids INTEGER[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 3. Tabla de Registros de Entrenamiento (Historial de Series)
CREATE TABLE workout_logs (
    id SERIAL PRIMARY KEY,
    exercise_id INTEGER REFERENCES exercises(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    sets JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(exercise_id, date)
);

-- Habilitar RLS (Row Level Security) opcionalmente, pero para uso personal permitiremos acceso anónimo:
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

-- Crear políticas para permitir todo el acceso (ya que es uso personal, no implementaremos Autenticación por ahora)
CREATE POLICY "Allow all operations for anon on exercises" ON exercises FOR ALL USING (true);
CREATE POLICY "Allow all operations for anon on routine_days" ON routine_days FOR ALL USING (true);
CREATE POLICY "Allow all operations for anon on workout_logs" ON workout_logs FOR ALL USING (true);

-- Migración v2 (Añadir muscle_group y equipment)
ALTER TABLE exercises ADD COLUMN muscle_group TEXT;
ALTER TABLE exercises ADD COLUMN equipment TEXT;
