import { Op } from 'sequelize';

import Pergunta from '../models/PerguntaModel.js';
import Variavel from '../models/VariavelModel.js';
import CopiaPergunta from '../models/CopiaPerguntaModel.js';

import {substituirVariaveis} from  '../utils/substituirVariavel.js';
import { registrarLog } from '../utils/logAlteracao.js';

//cada usuario soma no maximo uma copia por pergunta dentro da janela abaixo:
//evita que cliques repetidos subam artificialmente uma pergunta no ranking
const JANELA_LIMITE_COPIAS_MS = 24 * 60 * 60 * 1000;
const LIMITE_COPIAS_POR_USUARIO = 1;

export async function listarPerguntas(req, res) {
    try {

        //ranking de uso: as respostas mais copiadas aparecem primeiro
        const perguntas = await Pergunta.findAll({
            order: [['copias', 'DESC'], ['id', 'ASC']]
        });
        const variaveis = await Variavel.findAll();

        const resultado = perguntas.map(pergunta => {
            const dados = pergunta.toJSON();

            if (req.usuario?.tipo === 'admin') {
                dados.respostaOriginal = dados.resposta;
            }

            dados.resposta = substituirVariaveis( dados.resposta, variaveis);

            return dados;
        });
        
        res.json(resultado);
        
    } catch (error) {
        console.error(error);

        res.status(500).json({
            erro: 'Erro ao buscar perguntas.'
        });
    }
}

export async function criarPergunta(req, res) {
    try {
        const {
            titulo,
            resposta,
        } = req.body;

        const pergunta = await Pergunta.create({
            titulo,
            resposta,
        });

        await registrarLog(req, {
            entidade: 'pergunta',
            acao: 'criar',
            registroId: pergunta.id,
            descricao: `Cadastrou a pergunta "${pergunta.titulo}".`,
            dadosNovos: {
                titulo: pergunta.titulo,
                resposta: pergunta.resposta,
                ativo: pergunta.ativo
            }
        });

        res.status(201).json(pergunta);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            erro: 'Erro ao cadastrar pergunta.'
        });
    }
}

export async function atualizarPergunta(req, res) {
    try {
        const { id } = req.params;
        const { titulo, resposta } = req.body;

        if (!titulo || !resposta) {
            return res.status(400).json({
                erro: 'Título e resposta são obrigatórios.'
            });
        }

        const pergunta = await Pergunta.findByPk(id);

        if (!pergunta) {
            return res.status(404).json({
                erro: 'Pergunta não encontrada.'
            });
        }

        const dadosAnteriores = {
            titulo: pergunta.titulo,
            resposta: pergunta.resposta,
            ativo: pergunta.ativo
        };

        pergunta.titulo = titulo;
        pergunta.resposta = resposta;

        await pergunta.save();

        const dadosNovos = {
            titulo: pergunta.titulo,
            resposta: pergunta.resposta,
            ativo: pergunta.ativo
        };

        const houveAlteracao = dadosAnteriores.titulo !== dadosNovos.titulo
            || dadosAnteriores.resposta !== dadosNovos.resposta;

        if (houveAlteracao) {
            await registrarLog(req, {
                entidade: 'pergunta',
                acao: 'atualizar',
                registroId: pergunta.id,
                descricao: `Alterou a pergunta "${pergunta.titulo}".`,
                dadosAnteriores,
                dadosNovos
            });
        }

        res.json(pergunta);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            erro: 'Erro ao atualizar pergunta.'
        });
    }
}

export async function deletarPergunta(req, res) {
    try {
        const { id } = req.params;

        const pergunta = await Pergunta.findByPk(id);

        if (!pergunta) {
            return res.status(404).json({
                erro: 'Pergunta não encontrada.'
            });
        }

        await pergunta.destroy();

        await registrarLog(req, {
            entidade: 'pergunta',
            acao: 'excluir',
            registroId: pergunta.id,
            descricao: `Excluiu a pergunta "${pergunta.titulo}".`,
            dadosAnteriores: {
                titulo: pergunta.titulo,
                resposta: pergunta.resposta,
                ativo: pergunta.ativo
            }
        });

        res.json({
            mensagem: 'Pergunta excluída com sucesso.'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            erro: 'Erro ao excluir pergunta.'
        });
    }
}

export async function registrarCopia(req, res) {
    try {
        const { id } = req.params;

        if (!req.usuario?.id) {
            return res.status(401).json({
                erro: 'Sessão expirada. Faça login novamente.'
            });
        }

        const pergunta = await Pergunta.findByPk(id);

        if (!pergunta) {
            return res.status(404).json({
                erro: 'Pergunta não encontrada.'
            });
        }

        const copiasRecentes = await CopiaPergunta.count({
            where: {
                perguntaId: pergunta.id,
                usuarioId: req.usuario.id,
                createdAt: {
                    [Op.gte]: new Date(Date.now() - JANELA_LIMITE_COPIAS_MS)
                }
            }
        });

        //a copia do texto continua funcionando; apenas nao entra no ranking
        if (copiasRecentes >= LIMITE_COPIAS_POR_USUARIO) {
            return res.json({
                id: pergunta.id,
                copias: pergunta.copias,
                contabilizada: false
            });
        }

        await CopiaPergunta.create({
            perguntaId: pergunta.id,
            usuarioId: req.usuario.id
        });

        //incremento atomico: evita perder contagem com copias simultaneas
        await pergunta.increment('copias', { by: 1 });
        await pergunta.reload();

        res.json({
            id: pergunta.id,
            copias: pergunta.copias,
            contabilizada: true
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            erro: 'Erro ao registrar a cópia da resposta.'
        });
    }
}

export async function perguntaBusca(req, res) {
    res.render('perguntas', {
        isAdmin: req.usuario?.tipo === 'admin'
    });
}
