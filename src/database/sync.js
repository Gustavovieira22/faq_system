import sequelize from '../config/database.js';
import { DataTypes } from 'sequelize';

import Pergunta from '../models/PerguntaModel.js';
import '../models/VariavelModel.js';
import '../models/LogModel.js';
import '../models/CopiaPerguntaModel.js';
import Usuario from '../models/UsuarioModel.js';
import { gerarHashSenha } from '../utils/senha.js';

//adiciona a coluna apenas quando o banco ja existente ainda nao a possui
async function garantirColuna(tabela, coluna, definicao) {
    const queryInterface = sequelize.getQueryInterface();
    const colunas = await queryInterface.describeTable(tabela);

    if (!colunas[coluna]) {
        await queryInterface.addColumn(tabela, coluna, definicao);
    }
}

try {
    await sequelize.authenticate();

    await sequelize.sync();

    await garantirColuna(Usuario.getTableName(), 'tipo', {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'admin'
    });

    await garantirColuna(Pergunta.getTableName(), 'copias', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    });

    const totalUsuarios = await Usuario.count();

    if (totalUsuarios === 0) {
        const loginInicial = process.env.ADMIN_LOGIN || 'admin';
        const senhaInicial = process.env.ADMIN_PASSWORD || 'admin123';

        await Usuario.create({
            nome: 'Administrador',
            login: loginInicial,
            senhaHash: gerarHashSenha(senhaInicial),
            tipo: 'admin',
            ativo: true
        });

        console.log(`Usuário inicial criado. Login: ${loginInicial} | Senha: ${senhaInicial}`);
    }

    console.log('Banco de dados conectado e tabelas sincronizadas.');
} catch (error) {
    console.error('Erro ao conectar com o banco:', error);
}
