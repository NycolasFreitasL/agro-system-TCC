"use client";
import { useState } from "react";
import {useRouter} from "next/navigation";

const page = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const router = useRouter(); //variavel para redirecionar o usuario para a pagina de dashboard apos o login bem sucedido
    
    const [error,setError] = useState("");

    //bloco de validação do formulário
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); 

        const emailValue = email.trim();
        const passwordValue = password.trim();
   

        if (!emailValue) {
            setError("O campo de e-mail é obrigatório.");
            return;
        }
        if (!passwordValue) {
            setError("O campo de senha é obrigatório.");
            return;
        }
        const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);

        if (!emailValido) {
            setError("Por favor, insira um e-mail válido.");
            return;
        }
        setError("");
        //console.log(email, password);

        const response = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email: emailValue, password: passwordValue })});

        const data = await response.json();

        if (!response.ok) {
            setError(data.error || "Erro ao fazer login. Por favor, tente novamente.");
            return;
        }


        setError("login bem-sucedido");
        // alert(data.message);
        setTimeout(() => {
            router.push("/dashboard"); // Redireciona para o dashboard após login bem-sucedido

        }, 1500); // Aguarda 1.5 segundos antes de redirecionar para o dashboard
    
    }



    
    
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="w-full max-w-md bg-white p-6 rounded-xl shadow-md">
            <h1 className="text-2xl font-bold text-gray-800">Login</h1>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <label className="block text-sm font-medium text-gray-700">E-mail</label>
                <input className="w-full border text-gray-400 border-gray-300 rounded-md px-3 py-2 mt-1" type="email" placeholder="Digite seu e-mail" value={email} onChange={(e)=> setEmail(e.target.value)}/>

                <label className="block text-sm font-medium text-gray-700">Senha</label>
                <input className="w-full border text-gray-400 border-gray-300 rounded-md px-3 py-2 mt-1" type="password" placeholder="Digite sua senha" value={password} onChange={(e) => setPassword(e.target.value)}/>

                <button className="w-full bg-blue-950 text-white py-2 rounded-md mt-4 hover:bg-blue-900" type="submit">Entrar</button>
            </form>
            <p className="mt-4 text-center text-sm text-red-500">{error} </p>
        </div>
        
    </main>
  )

}
export default page;