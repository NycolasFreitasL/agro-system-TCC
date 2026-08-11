"use client";
import { useState } from "react";

const page = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); console.log(email, password); };

    const [error,setError] = useState("");

    if (email === "" ) {
        () => setError("O campo de e-mail é obrigatório.");
    }
    else if (password === "" ) {
        () => setError("O campo de senha é obrigatório.");
    }else {
        () => setError("");
    }
        
    
    
  return (
    <main>
        <>
            <h1>Login</h1>

            <form onSubmit={handleSubmit}>
                <label>E-mail</label>
                <input type="email" placeholder="Digite seu e-mail" value={email} onChange={(e)=> setEmail(e.target.value)}/>

                <label>Senha</label>
                <input type="password" placeholder="Digite sua senha" value={password} onChange={(e) => setPassword(e.target.value)}/>

                <button type="submit">Entrar</button>
            </form>
        </>
        <p>{error} </p>
    </main>
  )
}

export default page;