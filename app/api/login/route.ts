import {prisma} from "@/app/lib/prisma";
import bcrypt from "bcrypt";
import { error } from "next/dist/build/output/log";

// Handle POST requests para login do usuario
export async function POST(req: Request) {
    const { email, password } = await req.json(); 


  //verifica se nenhum dos campos está vazio, caso esteja retorna um erro
    if (!email || !password) {
        return new Response(JSON.stringify({ error: "Email e senha são obrigatórios" }), { status: 400 });
    }

    const usuario = await prisma.usuarios.findUnique({

        where: {
            email: email,
            }
    });

    if (!usuario) {
        return new Response(JSON.stringify({ error: "Usuário não encontrado" }), { status: 404 });
    };

    // verifica se a senha e o email estão corretos, caso não estejam retorna um erro

    //tirar as "//" depois quando estiver usando o bcrypt para criptografar a senha, por enquanto está assim para teste.
    const senhaCorreta = await bcrypt.compare(password, usuario.senha);

    
    //const senhaCorreta = password === usuario.senha;

    const emailValido = usuario.email === email

    if (!senhaCorreta || !emailValido) {
        console.log("Credenciais inválidas");
        return new Response(JSON.stringify({error: "Email ou senha incorretos"}), { status: 401 });
    }else {
        return new Response(JSON.stringify({message: "Login bem-sucedido"}), { status: 200 });
        console.log("Login bem-sucedido");
    }
}