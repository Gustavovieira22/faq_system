import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Pergunta = sequelize.define('Pergunta', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },

    titulo: {
        type: DataTypes.STRING,
        allowNull: false
    },

    resposta: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    
    ativo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }

    },{
        timestamps: true
});

export default Pergunta;