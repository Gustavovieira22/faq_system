import Variavel from '../models/VariavelModel.js';
import Pergunta from '../models/PerguntaModel.js';
import { registrarLog } from '../utils/logAlteracao.js';
import {
    construirPlanilha,
    lerPlanilha,
    nomeArquivoExportacao,
    ErroPlanilha
} from '../utils/planilhaVariaveis.js';
import {
    resolverRenomeacoes,
    temRenomeacoes,
    descreverRenomeacoes,
    renomearVariaveisNoTexto
} from '../utils/renomearVariaveis.js';

const TIPO_PLANILHA = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function responderErroPlanilha(error, res, mensagemPadrao) {
    if (error instanceof ErroPlanilha) {
        return res.status(error.status).json({
            erro: error.message
        });
    }

    console.error(error);

    return res.status(500).json({
        erro: mensagemPadrao
    });
}

export async function listarVariaveis(req, res) {
    try {
        const variaveis = await Variavel.findAll({
            order: [['nome', 'ASC']]
        });

        res.json(variaveis);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            erro: 'Erro ao buscar variáveis.'
        });
    }
}

export async function criarVariavel(req, res) {
    try {
        const { nome, valor } = req.body;

        if (!nome || !valor) {
            return res.status(400).json({
                erro: 'Nome e valor são obrigatórios.'
            });
        }

        const variavel = await Variavel.create({
            nome,
            valor
        });

        await registrarLog(req, {
            entidade: 'variavel',
            acao: 'criar',
            registroId: variavel.id,
            descricao: `Cadastrou a variável "${variavel.nome}".`,
            dadosNovos: {
                nome: variavel.nome,
                valor: variavel.valor
            }
        });

        res.status(201).json(variavel);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            erro: 'Erro ao cadastrar variável.'
        });
    }
}

//espelha as renomeacoes nos textos das perguntas: evita marcadores apontando para variaveis extintas
async function ajustarPerguntasRenomeadas(renomeacoes, transaction) {
    if (!temRenomeacoes(renomeacoes)) {
        return [];
    }

    const perguntas = await Pergunta.findAll({ transaction });
    const ajustadas = [];

    for (const pergunta of perguntas) {
        const titulo = renomearVariaveisNoTexto(pergunta.titulo, renomeacoes);
        const resposta = renomearVariaveisNoTexto(pergunta.resposta, renomeacoes);

        if (titulo === pergunta.titulo && resposta === pergunta.resposta) {
            continue;
        }

        ajustadas.push({
            id: pergunta.id,
            ativo: pergunta.ativo,
            tituloAnterior: pergunta.titulo,
            respostaAnterior: pergunta.resposta,
            titulo,
            resposta
        });

        pergunta.titulo = titulo;
        pergunta.resposta = resposta;

        await pergunta.save({ transaction });
    }

    return ajustadas;
}

export async function salvarTabelaVariaveis(req, res) {
    const transaction = await Variavel.sequelize.transaction();

    try {
        const { variaveis, renomeacoes: renomeacoesEnviadas } = req.body ?? {};

        if (!Array.isArray(variaveis)) {
            await transaction.rollback();

            return res.status(400).json({
                erro: 'Lista de variaveis invalida.'
            });
        }

        const nomes = new Set();
        const registros = [];

        for (const item of variaveis) {
            const nome = String(item.nome ?? '').trim();
            const valor = String(item.valor ?? '').trim();

            if (!nome || !valor) {
                continue;
            }

            if (!/^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)?$/.test(nome)) {
                await transaction.rollback();

                return res.status(400).json({
                    erro: `Nome de variavel invalido: ${nome}`
                });
            }

            if (nomes.has(nome)) {
                await transaction.rollback();

                return res.status(400).json({
                    erro: `Variavel duplicada: ${nome}`
                });
            }

            nomes.add(nome);
            registros.push({ nome, valor });
        }

        const variaveisAnteriores = await Variavel.findAll({
            order: [['nome', 'ASC']],
            transaction
        });

        await Variavel.destroy({ where: {}, transaction });

        if (registros.length > 0) {
            await Variavel.bulkCreate(registros, { transaction });
        }

        //a tela avisa quais nomes mudaram; os textos das perguntas acompanham a mudanca
        const renomeacoes = resolverRenomeacoes(renomeacoesEnviadas, registros);
        const perguntasAjustadas = await ajustarPerguntasRenomeadas(renomeacoes, transaction);

        await transaction.commit();

        const variaveisSalvas = await Variavel.findAll({
            order: [['nome', 'ASC']]
        });

        const mapaAnterior = new Map(variaveisAnteriores.map(variavel => [variavel.nome, variavel.valor]));
        const mapaNovo = new Map(registros.map(registro => [registro.nome, registro.valor]));

        const inclusoes = registros.filter(registro => !mapaAnterior.has(registro.nome));
        const exclusoes = variaveisAnteriores.filter(variavel => !mapaNovo.has(variavel.nome));
        const alteracoes = registros.filter(registro => (
            mapaAnterior.has(registro.nome) && mapaAnterior.get(registro.nome) !== registro.valor
        ));

        if (inclusoes.length + exclusoes.length + alteracoes.length > 0) {
            const plural = (quantidade, singular, pluralTexto) => (
                `${quantidade} ${quantidade === 1 ? singular : pluralTexto}`
            );

            const resumo = [
                inclusoes.length > 0 ? plural(inclusoes.length, 'inclusão', 'inclusões') : null,
                alteracoes.length > 0 ? plural(alteracoes.length, 'alteração', 'alterações') : null,
                exclusoes.length > 0 ? plural(exclusoes.length, 'exclusão', 'exclusões') : null
            ].filter(Boolean).join(', ');

            await registrarLog(req, {
                entidade: 'variavel',
                acao: 'salvar',
                descricao: `Atualizou a tabela de variáveis (${resumo}).`,
                dadosAnteriores: variaveisAnteriores.map(variavel => ({
                    nome: variavel.nome,
                    valor: variavel.valor
                })),
                dadosNovos: registros
            });
        }

        //cada pergunta ajustada entra no log como uma alteracao propria
        for (const pergunta of perguntasAjustadas) {
            await registrarLog(req, {
                entidade: 'pergunta',
                acao: 'atualizar',
                registroId: pergunta.id,
                descricao: `Ajustou as variáveis da pergunta "${pergunta.titulo}" após renomear: ${descreverRenomeacoes(renomeacoes)}.`,
                dadosAnteriores: {
                    titulo: pergunta.tituloAnterior,
                    resposta: pergunta.respostaAnterior,
                    ativo: pergunta.ativo
                },
                dadosNovos: {
                    titulo: pergunta.titulo,
                    resposta: pergunta.resposta,
                    ativo: pergunta.ativo
                }
            });
        }

        res.json({
            variaveis: variaveisSalvas,
            perguntasAtualizadas: perguntasAjustadas.length
        });

    } catch (error) {
        if (!transaction.finished) {
            await transaction.rollback();
        }

        console.error(error);

        res.status(500).json({
            erro: 'Erro ao salvar variaveis.'
        });
    }
}

export async function atualizarVariavel(req, res) {
    try {
        const { id } = req.params;
        const { valor } = req.body;

        if (!valor) {
            return res.status(400).json({
                erro: 'O valor da variável é obrigatório.'
            });
        }

        const variavel = await Variavel.findByPk(id);

        if (!variavel) {
            return res.status(404).json({
                erro: 'Variável não encontrada.'
            });
        }

        const valorAnterior = variavel.valor;

        variavel.valor = valor;

        await variavel.save();

        if (valorAnterior !== variavel.valor) {
            await registrarLog(req, {
                entidade: 'variavel',
                acao: 'atualizar',
                registroId: variavel.id,
                descricao: `Alterou a variável "${variavel.nome}".`,
                dadosAnteriores: {
                    nome: variavel.nome,
                    valor: valorAnterior
                },
                dadosNovos: {
                    nome: variavel.nome,
                    valor: variavel.valor
                }
            });
        }

        res.json(variavel);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            erro: 'Erro ao atualizar variável.'
        });
    }
}

export async function variavelForm(req, res) {
    res.render('cadastrarVariaveis');
}

//gera a planilha a partir do estado atual da tela (inclui alteracoes ainda nao salvas)
export async function exportarTabelaVariaveis(req, res) {
    try {
        const { linhas, colunas } = req.body ?? {};

        const workbook = construirPlanilha({ linhas, colunas });
        const buffer = await workbook.xlsx.writeBuffer();
        const nomeArquivo = nomeArquivoExportacao();

        res.setHeader('Content-Type', TIPO_PLANILHA);
        res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'no-store');

        return res.end(Buffer.from(buffer));

    } catch (error) {
        return responderErroPlanilha(error, res, 'Erro ao gerar a planilha.');
    }
}

//apenas interpreta e valida o arquivo; a gravacao continua acontecendo em salvarTabelaVariaveis
export async function importarTabelaVariaveis(req, res) {
    try {
        const dados = await lerPlanilha(req.body);

        return res.json(dados);

    } catch (error) {
        return responderErroPlanilha(error, res, 'Erro ao ler a planilha enviada.');
    }
}

