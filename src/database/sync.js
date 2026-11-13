import sequelize from '../config/database.js';
import { DataTypes } from 'sequelize';

import '../models/PerguntaModel.js';
import '../models/VariavelModel.js';
import Usuario from '../models/UsuarioModel.js';
import { gerarHashSenha } from '../utils/senha.js';

async function garantirColunaTipoUsuario() {
    const queryInterface = sequelize.getQueryInterface();
    const tabelaUsuarios = Usuario.getTableName();
    const colunas = await queryInterface.describeTable(tabelaUsuarios);

    if (!colunas.tipo) {
        await queryInterface.addColumn(tabelaUsuarios, 'tipo', {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'admin'
        });
    }
}

try {
    await sequelize.authenticate();

    await sequelize.sync();
    await garantirColunaTipoUsuario();

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
