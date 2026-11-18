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
    },

    //quantidade de vezes que a resposta foi copiada: base do ranking de uso
    copias: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    }

    },{
        timestamps: true
});

export default Pergunta;