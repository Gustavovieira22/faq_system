import express from 'express';
import './database/sync.js';

import authRoutes from './routes/authRoutes.js';
import perguntaRoutes from './routes/perguntaRoutes.js';
import usuarioRoutes from './routes/usuarioRoutes.js';
import variavelRoutes from './routes/variavelRoutes.js';
import { autenticar } from './middlewares/authMiddleware.js';

const PORT = 3000;
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('./src/public'));

app.set('view engine', 'ejs');
app.set('views', './src/views');

app.use('/', authRoutes);
app.use(autenticar);
app.use('/', perguntaRoutes);
app.use('/', variavelRoutes);
app.use('/', usuarioRoutes);
app.use((req, res) => res.redirect("/buscar/perguntas"));

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
