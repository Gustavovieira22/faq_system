import LogAlteracao from '../models/LogModel.js';

function paraJson(dados) {
    if (dados === undefined || dados === null) {
        return null;
    }

    try {
        return JSON.stringify(dados);
    } catch (error) {
        console.error('Erro ao serializar dados do log:', error);

        return null;
    }
}

//nunca interrompe a operacao principal: falha de auditoria apenas gera aviso no console
export async function registrarLog(req, {
    entidade,
    acao,
    registroId = null,
    descricao,
    dadosAnteriores = null,
    dadosNovos = null
}) {
    try {
        const usuario = req.usuario || {};

        await LogAlteracao.create({
            usuarioId: usuario.id ?? null,
            usuarioNome: usuario.nome || 'Sistema',
            usuarioLogin: usuario.login || 'sistema',
            entidade,
            acao,
            registroId: registroId === null || registroId === undefined ? null : String(registroId),
            descricao,
            dadosAnteriores: paraJson(dadosAnteriores),
            dadosNovos: paraJson(dadosNovos)
        });

    } catch (error) {
        console.error('Erro ao registrar log de alteração:', error);
    }
}
