"use client";

import React from "react";
import Sidebar from "../components/sidebar";

const page = () => {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-4">
          Bem-vindo ao Animais
        </h1>

        <p>Este é o conteúdo principal dos Animais.</p>
      </main>
    </div>
  );
};

export default page;