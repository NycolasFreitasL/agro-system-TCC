import  Link  from "next/link";

const Sidebar = () => {
    return (
        <aside className="w-64 min-h-screen bg-slate-900 text-white p-4">
            <div className="mb-8">
                <h2 className="text-xl font-bold">🌾 AgroSystem</h2>
            </div>

            <nav className="space-y-2">
                <Link
                    href="/dashboard"
                    className="block w-full px-3 py-2 rounded-md hover:bg-slate-700"
                >
                    📊 Dashboard
                </Link>

                <Link
                    href="/animais"
                    className="block w-full px-3 py-2 rounded-md hover:bg-slate-700"
                >
                    🐄 Animais
                </Link>

                <Link
                    href="/plantio"
                    className="block w-full px-3 py-2 rounded-md hover:bg-slate-700"
                >
                    🌱 Plantio
                </Link>

                <Link
                    href="/estoque"
                    className="block w-full px-3 py-2 rounded-md hover:bg-slate-700"
                >
                    📦 Estoque
                </Link>
            </nav>
        </aside>
    )
}

export default Sidebar;
