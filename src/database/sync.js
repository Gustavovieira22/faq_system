import sequelize from '../config/database.js';

import '../models/PerguntaModel.js';
import '../models/VariavelModel.js';
import Usuario from '../models/UsuarioModel.js';
import { gerarHashSenha } from '../utils/senha.js';

try {
    await sequelize.authenticate();

    await sequelize.sync();

    const totalUsuarios = await Usuario.count();

    if (totalUsuarios === 0) {
        const loginInicial = process.env.ADMIN_LOGIN || 'admin';
        const senhaInicial = process.env.ADMIN_PASSWORD || 'admin123';

        await Usuario.create({
            nome: 'Administrador',
            login: loginInicial,
            senhaHash: gerarHashSenha(senhaInicial),
            ativo: true
        });

        console.log(`Usuário inicial criado. Login: ${loginInicial} | Senha: ${senhaInicial}`);
    }

    console.log('Banco de dados conectado e tabelas sincronizadas.');
} catch (error) {
    console.error('Erro ao conectar com o banco:', error);
}
