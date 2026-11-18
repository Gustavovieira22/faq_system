import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

//cada copia contabilizada no ranking: permite limitar quantas vezes o mesmo usuario soma por pergunta
const CopiaPergunta = sequelize.define('CopiaPergunta', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },

    perguntaId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },

    usuarioId: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, {
    tableName: 'copias_perguntas',
    timestamps: true,
    indexes: [
        {
            name: 'idx_copias_pergunta_usuario_data',
            fields: ['perguntaId', 'usuarioId', 'createdAt']
        }
    ]
});

export default CopiaPergunta;
