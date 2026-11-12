import Variavel from '../models/VariavelModel.js';

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