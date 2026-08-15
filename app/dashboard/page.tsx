"use client";

import React from "react";

const page = () => {
  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white min-h-screen p-4">
        <div className="mb-8">
          <h2 className="text-xl font-bold">AgroSystem</h2>
        </div>
        <nav className="space-y-2">
          <button className="w-full text-left px-3 py-2 rounded-md bg-slate-700">
            Dashboard
          </button>
          <button className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-700">
            Animais
          </button>
          <button className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-700">
            Plantio
          </button>
          <button className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-700">
            Produtos
          </button>
        </nav>
      </aside>

      {/* Main content area */}
      <main className="min-h-screen bg-slate-100 p-6">
        <h1 className="text-2xl font-bold mb-4">Bem-vindo ao Dashboard</h1>
        <p>Este é o conteúdo principal do dashboard.</p>
      </main>
    </div>
  );
};

export default page;
