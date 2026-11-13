import Usuario from '../models/UsuarioModel.js';
import { gerarHashSenha, validarSenha } from '../utils/senha.js';

async function carregarUsuarios() {
    return Usuario.findAll({
        attributes: ['id', 'nome', 'login', 'tipo', 'ativo', 'createdAt'],
        order: [['nome', 'ASC']]
    });
}

export async function usuarioForm(req, res) {
    const usuarios = await carregarUsuarios();

    res.render('usuarios', {
        usuarios,
        erro: null,
        sucesso: null
    });
}

export async function criarUsuario(req, res) {
    const { nome, login, senha, tipo } = req.body;

    try {
        if (!nome || !login || !senha) {
            throw new Error('Nome, login e senha são obrigatórios.');
        }

        if (!['admin', 'comum'].includes(tipo)) {
            throw new Error('Tipo de usuario invalido.');
        }

        if (senha.length < 6) {
            throw new Error('A senha precisa ter pelo menos 6 caracteres.');
        }

        await Usuario.create({
            nome,
            login,
            senhaHash: gerarHashSenha(senha),
            tipo,
            ativo: true
        });

        const usuarios = await carregarUsuarios();

        res.render('usuarios', {
            usuarios,
            erro: null,
            sucesso: 'Usuário cadastrado com sucesso.'
        });

    } catch (error) {
        const usuarios = await carregarUsuarios();

        res.status(400).render('usuarios', {
            usuarios,
            erro: error.message || 'Erro ao cadastrar usuário.',
            sucesso: null
        });
    }
}

export async function alterarMinhaSenha(req, res) {
    const { senhaAtual, novaSenha } = req.body;

    try {
        if (!senhaAtual || !novaSenha) {
            throw new Error('Informe a senha atual e a nova senha.');
        }

        if (novaSenha.length < 6) {
            throw new Error('A nova senha precisa ter pelo menos 6 caracteres.');
        }

        const usuario = await Usuario.findByPk(req.usuario.id);

        if (!usuario || !validarSenha(senhaAtual, usuario.senhaHash)) {
            throw new Error('Senha atual inválida.');
        }

        usuario.senhaHash = gerarHashSenha(novaSenha);
        await usuario.save();

        const usuarios = await carregarUsuarios();

        res.render('usuarios', {
            usuarios,
            erro: null,
            sucesso: 'Senha alterada com sucesso.'
        });

    } catch (error) {
        const usuarios = await carregarUsuarios();

        res.status(400).render('usuarios', {
            usuarios,
            erro: error.message || 'Erro ao alterar senha.',
            sucesso: null
        });
    }
}
