import crypto from 'crypto';

const ITERACOES = 120000;
const TAMANHO_CHAVE = 64;
const DIGEST = 'sha512';

export function gerarHashSenha(senha) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto
        .pbkdf2Sync(senha, salt, ITERACOES, TAMANHO_CHAVE, DIGEST)
        .toString('hex');

    return `${ITERACOES}:${salt}:${hash}`;
}

export function validarSenha(senha, senhaHash) {
    if (!senha || !senhaHash) {
        return false;
    }

    const [iteracoes, salt, hashOriginal] = senhaHash.split(':');

    if (!iteracoes || !salt || !hashOriginal) {
        return false;
    }

    const hashInformado = crypto
        .pbkdf2Sync(senha, salt, Number(iteracoes), TAMANHO_CHAVE, DIGEST)
        .toString('hex');

    return crypto.timingSafeEqual(
        Buffer.from(hashOriginal, 'hex'),
        Buffer.from(hashInformado, 'hex')
    );
}
