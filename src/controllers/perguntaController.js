import Pergunta from '../models/PerguntaModel.js';
import Variavel from '../models/VariavelModel.js';

import {substituirVariaveis} from  '../utils/substituirVariavel.js';

export async function listarPerguntas(req, res) {
    try {

        const perguntas = await Pergunta.findAll();
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

        pergunta.titulo = titulo;
        pergunta.resposta = resposta;

        await pergunta.save();

        res.json(pergunta);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            erro: 'Erro ao atualizar pergunta.'
        });
    }
}

export async function perguntaBusca(req, res) {
    res.render('perguntas', {
        isAdmin: req.usuario?.tipo === 'admin'
    });
}
