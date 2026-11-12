import crypto from 'crypto';

const SEGREDO = process.env.AUTH_SECRET || 'troque-este-segredo-em-producao';
const NOME_COOKIE = 'faq_auth';
const DURACAO_TOKEN_MS = 1000 * 60 * 60 * 8;

function base64Url(valor) {
    return Buffer
        .from(valor)
        .toString('base64url');
}

function assinar(payload) {
    return crypto
        .createHmac('sha256', SEGREDO)
        .update(payload)
        .digest('base64url');
}

export function criarToken(usuario) {
    const payload = base64Url(JSON.stringify({
        id: usuario.id,
        nome: usuario.nome,
        login: usuario.login,
        expiraEm: Date.now() + DURACAO_TOKEN_MS
    }));

    return `${payload}.${assinar(payload)}`;
}

export function validarToken(token) {
    if (!token || !token.includes('.')) {
        return null;
    }

    const [payload, assinatura] = token.split('.');
    const assinaturaEsperada = assinar(payload);

    try {
        const assinaturaValida = crypto.timingSafeEqual(
            Buffer.from(assinatura),
            Buffer.from(assinaturaEsperada)
        );

        if (!assinaturaValida) {
            return null;
        }

        const dados = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));

        if (!dados.expiraEm || dados.expiraEm < Date.now()) {
            return null;
        }

        return dados;
    } catch (error) {
        return null;
    }
}

export function lerCookies(req) {
    return (req.headers.cookie || '')
        .split(';')
        .filter(Boolean)
        .reduce((cookies, cookie) => {
            const [nome, ...partesValor] = cookie.trim().split('=');
            cookies[nome] = decodeURIComponent(partesValor.join('='));
            return cookies;
        }, {});
}

export function configurarCookieAutenticacao(res, token) {
    res.cookie(NOME_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: DURACAO_TOKEN_MS
    });
}

export function limparCookieAutenticacao(res) {
    res.clearCookie(NOME_COOKIE);
}

export { NOME_COOKIE };
