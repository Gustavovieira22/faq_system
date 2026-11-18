import { Op } from 'sequelize';
import LogAlteracao from '../models/LogModel.js';

const REGISTROS_POR_PAGINA = 50;

export const ROTULOS_ENTIDADES = {
    pergunta: 'Pergunta',
    variavel: 'Variável',
    usuario: 'Usuário'
};

export const ROTULOS_ACOES = {
    criar: 'Criação',
    atualizar: 'Alteração',
    excluir: 'Exclusão',
    salvar: 'Tabela de variáveis',
    senha: 'Senha'
};

const CLASSES_ACOES = {
    criar: 'success',
    atualizar: 'primary',
    excluir: 'danger',
    salvar: 'warning',
    senha: 'info'
};

const ROTULOS_CAMPOS = {
    titulo: 'Título',
    resposta: 'Resposta',
    nome: 'Nome',
    valor: 'Valor',
    login: 'Login',
    tipo: 'Tipo',
    ativo: 'Ativo'
};

const formatadorData = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium'
});

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;

function formatarData(data) {
    if (!data) {
        return '-';
    }

    return formatadorData.format(new Date(data));
}

function formatarValor(valor) {
    if (valor === undefined || valor === null) {
        return '';
    }

    if (typeof valor === 'object') {
        return JSON.stringify(valor, null, 2);
    }

    return String(valor);
}

function lerJson(texto) {
    if (!texto) {
        return null;
    }

    try {
        return JSON.parse(texto);
    } catch (error) {
        return null;
    }
}

function formatarBlocoJson(texto) {
    const dados = lerJson(texto);

    if (!dados) {
        return '';
    }

    return JSON.stringify(dados, null, 2);
}

//mostra campo a campo o que mudou (criacao, alteracao e exclusao)
function montarDetalhes(dadosAnteriores, dadosNovos) {
    const anteriores = lerJson(dadosAnteriores);
    const novos = lerJson(dadosNovos);

    //listas (ex.: tabela de variaveis) sao exibidas apenas como JSON completo
    if (Array.isArray(anteriores) || Array.isArray(novos)) {
        return [];
    }

    const mapaAnterior = anteriores || {};
    const mapaNovo = novos || {};

    const campos = new Set([
        ...Object.keys(mapaAnterior),
        ...Object.keys(mapaNovo)
    ]);

    return [...campos]
        .map(campo => ({
            campo: ROTULOS_CAMPOS[campo] || campo,
            antes: formatarValor(mapaAnterior[campo]),
            depois: formatarValor(mapaNovo[campo])
        }))
        .filter(detalhe => detalhe.antes !== detalhe.depois);
}

function montarUrl(filtros, pagina) {
    const parametros = new URLSearchParams();

    Object.entries(filtros).forEach(([chave, valor]) => {
        if (valor) {
            parametros.set(chave, valor);
        }
    });

    if (pagina > 1) {
        parametros.set('pagina', String(pagina));
    }

    const queryString = parametros.toString();

    return queryString ? `/logs?${queryString}` : '/logs';
}

function montarFiltros(query) {
    const entidade = String(query.entidade || '').trim();
    const acao = String(query.acao || '').trim();
    const dataInicio = String(query.dataInicio || '').trim();
    const dataFim = String(query.dataFim || '').trim();

    return {
        busca: String(query.busca || '').trim(),
        usuario: String(query.usuario || '').trim(),
        entidade: ROTULOS_ENTIDADES[entidade] ? entidade : '',
        acao: ROTULOS_ACOES[acao] ? acao : '',
        dataInicio: REGEX_DATA.test(dataInicio) ? dataInicio : '',
        dataFim: REGEX_DATA.test(dataFim) ? dataFim : ''
    };
}

function montarWhere(filtros) {
    const where = {};

    if (filtros.entidade) {
        where.entidade = filtros.entidade;
    }

    if (filtros.acao) {
        where.acao = filtros.acao;
    }

    if (filtros.usuario) {
        where.usuarioLogin = filtros.usuario;
    }

    if (filtros.busca) {
        where[Op.or] = [
            { descricao: { [Op.like]: `%${filtros.busca}%` } },
            { usuarioNome: { [Op.like]: `%${filtros.busca}%` } },
            { usuarioLogin: { [Op.like]: `%${filtros.busca}%` } }
        ];
    }

    const filtroData = {};

    if (filtros.dataInicio) {
        filtroData[Op.gte] = new Date(`${filtros.dataInicio}T00:00:00`);
    }

    if (filtros.dataFim) {
        filtroData[Op.lte] = new Date(`${filtros.dataFim}T23:59:59.999`);
    }

    if (Object.getOwnPropertySymbols(filtroData).length > 0) {
        where.createdAt = filtroData;
    }

    return where;
}

async function carregarUsuariosComLog() {
    const usuarios = await LogAlteracao.findAll({
        attributes: ['usuarioNome', 'usuarioLogin'],
        group: ['usuarioNome', 'usuarioLogin'],
        order: [['usuarioNome', 'ASC']]
    });

    return usuarios.map(usuario => ({
        nome: usuario.usuarioNome,
        login: usuario.usuarioLogin
    }));
}

export async function logsForm(req, res) {
    try {
        const filtros = montarFiltros(req.query);
        const where = montarWhere(filtros);

        const total = await LogAlteracao.count({ where });
        const totalPaginas = Math.max(1, Math.ceil(total / REGISTROS_POR_PAGINA));

        const paginaInformada = Number.parseInt(req.query.pagina, 10) || 1;
        const paginaAtual = Math.min(Math.max(paginaInformada, 1), totalPaginas);

        const registros = await LogAlteracao.findAll({
            where,
            order: [['createdAt', 'DESC'], ['id', 'DESC']],
            limit: REGISTROS_POR_PAGINA,
            offset: (paginaAtual - 1) * REGISTROS_POR_PAGINA
        });

        const logs = registros.map(registro => ({
            id: registro.id,
            dataHora: formatarData(registro.createdAt),
            usuarioNome: registro.usuarioNome,
            usuarioLogin: registro.usuarioLogin,
            entidadeRotulo: ROTULOS_ENTIDADES[registro.entidade] || registro.entidade,
            acaoRotulo: ROTULOS_ACOES[registro.acao] || registro.acao,
            acaoClasse: CLASSES_ACOES[registro.acao] || 'secondary',
            registroId: registro.registroId,
            descricao: registro.descricao,
            detalhes: montarDetalhes(registro.dadosAnteriores, registro.dadosNovos),
            dadosAnteriores: formatarBlocoJson(registro.dadosAnteriores),
            dadosNovos: formatarBlocoJson(registro.dadosNovos)
        }));

        const paginas = [];
        const primeiraPagina = Math.max(1, paginaAtual - 2);
        const ultimaPagina = Math.min(totalPaginas, paginaAtual + 2);

        for (let numero = primeiraPagina; numero <= ultimaPagina; numero += 1) {
            paginas.push({
                numero,
                url: montarUrl(filtros, numero),
                ativa: numero === paginaAtual
            });
        }

        res.render('logs', {
            logs,
            total,
            paginaAtual,
            totalPaginas,
            paginas,
            temPaginaAnterior: paginaAtual > 1,
            temProximaPagina: paginaAtual < totalPaginas,
            urlPaginaAnterior: montarUrl(filtros, paginaAtual - 1),
            urlProximaPagina: montarUrl(filtros, paginaAtual + 1),
            filtros,
            usuarios: await carregarUsuariosComLog(),
            entidades: ROTULOS_ENTIDADES,
            acoes: ROTULOS_ACOES,
            possuiFiltros: Object.values(filtros).some(Boolean),
            erro: null
        });

    } catch (error) {
        console.error(error);

        res.status(500).render('logs', {
            logs: [],
            total: 0,
            paginaAtual: 1,
            totalPaginas: 1,
            paginas: [],
            temPaginaAnterior: false,
            temProximaPagina: false,
            urlPaginaAnterior: '/logs',
            urlProximaPagina: '/logs',
            filtros: montarFiltros({}),
            usuarios: [],
            entidades: ROTULOS_ENTIDADES,
            acoes: ROTULOS_ACOES,
            possuiFiltros: false,
            erro: 'Erro ao carregar os logs de alterações.'
        });
    }
}
