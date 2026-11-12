import Usuario from '../models/UsuarioModel.js';
import { configurarCookieAutenticacao, criarToken, limparCookieAutenticacao } from '../utils/authToken.js';
import { validarSenha } from '../utils/senha.js';

export function loginForm(req, res) {
    res.render('login', {
        erro: null
    });
}

export async function login(req, res) {
    try {
        const { login, senha } = req.body;

        if (!login || !senha) {
            return res.status(400).render('login', {
                erro: 'Informe login e senha.'
            });
        }

        const usuario = await Usuario.findOne({
            where: {
                login,
                ativo: true
            }
        });

        if (!usuario || !validarSenha(senha, usuario.senhaHash)) {
            return res.status(401).render('login', {
                erro: 'Login ou senha inválidos.'
            });
        }

        configurarCookieAutenticacao(res, criarToken(usuario));

        res.redirect('/buscar/perguntas');

    } catch (error) {
        console.error(error);

        res.status(500).render('login', {
            erro: 'Erro ao entrar. Tente novamente.'
        });
    }
}

export function logout(req, res) {
    limparCookieAutenticacao(res);
    res.redirect('/login');
}
