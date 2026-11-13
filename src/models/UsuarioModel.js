import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Usuario = sequelize.define('Usuario', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },

    nome: {
        type: DataTypes.STRING,
        allowNull: false
    },

    login: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },

    senhaHash: {
        type: DataTypes.TEXT,
        allowNull: false
    },

    tipo: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'admin',
        validate: {
            isIn: [['admin', 'comum']]
        }
    },

    ativo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
}, {
    timestamps: true
});

export default Usuario;
