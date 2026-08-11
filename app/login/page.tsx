import { useState } from "react";

const page = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
  return (
    <main>
        <>
            <h1>Login</h1>

            <form>
                <label>E-mail</label>
                <input type="email" placeholder="Digite seu e-mail" onChange={(e)=> setEmail(e.target.value)}/>

                <label>Senha</label>
                <input type="password" placeholder="Digite sua senha"  onChange={(e) => setPassword(e.target.value)}/>

                <button type="submit">Entrar</button>
            </form>
        </>
    </main>
  )
}

export default page;