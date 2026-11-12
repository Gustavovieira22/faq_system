import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Variavel = sequelize.define('Variavel', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },

    nome: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },

    valor: {
        type: DataTypes.TEXT,
        allowNull: false
    }
});

export default Variavel;