import { lerCookies, NOME_COOKIE, validarToken } from '../utils/authToken.js';
import Usuario from '../models/UsuarioModel.js';

export async function autenticar(req, res, next) {
    const cookies = lerCookies(req);
    const usuarioToken = validarToken(cookies[NOME_COOKIE]);

    if (!usuarioToken) {
        return res.redirect('/login');
    }

    const usuario = await Usuario.findOne({
        where: {
            id: usuarioToken.id,
            ativo: true
        },
        attributes: ['id', 'nome', 'login']
    });

    if (!usuario) {
        return res.redirect('/login');
    }

    req.usuario = usuario.toJSON();
    res.locals.usuario = req.usuario;

    next();
}

export function redirecionarSeAutenticado(req, res, next) {
    const cookies = lerCookies(req);
    const usuario = validarToken(cookies[NOME_COOKIE]);

    if (usuario) {
        return res.redirect('/buscar/perguntas');
    }

    next();
}
