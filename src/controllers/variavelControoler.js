import Variavel from '../models/VariavelModel.js';
import {
    construirPlanilha,
    lerPlanilha,
    nomeArquivoExportacao,
    ErroPlanilha
} from '../utils/planilhaVariaveis.js';

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

        res.status(201).json(variavel);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            erro: 'Erro ao cadastrar variável.'
        });
    }
}

export async function salvarTabelaVariaveis(req, res) {
    const transaction = await Variavel.sequelize.transaction();

    try {
        const { variaveis } = req.body;

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

        await Variavel.destroy({ where: {}, transaction });

        if (registros.length > 0) {
            await Variavel.bulkCreate(registros, { transaction });
        }

        await transaction.commit();

        const variaveisSalvas = await Variavel.findAll({
            order: [['nome', 'ASC']]
        });

        res.json(variaveisSalvas);

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

        variavel.valor = valor;

        await variavel.save();

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

