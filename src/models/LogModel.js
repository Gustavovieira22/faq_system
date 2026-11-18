import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

//registro de auditoria: guarda quem alterou o que e quando
const LogAlteracao = sequelize.define('LogAlteracao', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },

    usuarioId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },

    usuarioNome: {
        type: DataTypes.STRING,
        allowNull: false
    },

    usuarioLogin: {
        type: DataTypes.STRING,
        allowNull: false
    },

    //pergunta, variavel ou usuario
    entidade: {
        type: DataTypes.STRING,
        allowNull: false
    },

    //criar, atualizar, excluir, salvar ou senha
    acao: {
        type: DataTypes.STRING,
        allowNull: false
    },

    registroId: {
        type: DataTypes.STRING,
        allowNull: true
    },

    descricao: {
        type: DataTypes.TEXT,
        allowNull: false
    },

    //snapshots em JSON para exibir as diferencas na tela de logs
    dadosAnteriores: {
        type: DataTypes.TEXT,
        allowNull: true
    },

    dadosNovos: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'logs',
    timestamps: true
});

export default LogAlteracao;
