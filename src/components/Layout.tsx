import { Outlet, NavLink } from 'react-router-dom';
import { Home, Calendar, BarChart2 } from 'lucide-react';

export default function Layout() {
    return (
        <div className="flex flex-col h-screen bg-background text-foreground">
            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto pb-20">
                <Outlet />
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 w-full bg-card border-t border-border px-2 py-3 grid grid-cols-3 items-center z-50 safe-area-pb">
                <NavLink
                    to="/"
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                        }`
                    }
                >
                    <Home size={24} />
                    <span className="text-xs font-medium">Inicio</span>
                </NavLink>

                <NavLink
                    to="/routine"
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                        }`
                    }
                >
                    <Calendar size={24} />
                    <span className="text-xs font-medium">Rutina</span>
                </NavLink>

                <NavLink
                    to="/stats"
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                        }`
                    }
                >
                    <BarChart2 size={24} />
                    <span className="text-xs font-medium">Estadísticas</span>
                </NavLink>
            </nav>
        </div>
    );
}
