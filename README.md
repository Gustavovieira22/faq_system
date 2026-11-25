# FAQ Respostas — Central de respostas do FAQ

Aplicação web interna para centralizar, pesquisar e reutilizar respostas prontas de atendimento. O operador digita o assunto, encontra a resposta mais relevante, abre o item e copia o texto já formatado para o WhatsApp. As respostas mais copiadas sobem no ranking e ficam no topo.

O sistema também oferece uma área administrativa completa: cadastro de perguntas com editor de texto rico, tabela de variáveis reutilizáveis (com importação/exportação em Excel), gestão de usuários e trilha de auditoria de todas as alterações.

> Projeto da central de atendimento **PUC Goiás CAD**.

---

## Sumário

- [Visão geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Stack tecnológica](#stack-tecnológica)
- [Arquitetura](#arquitetura)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Pré-requisitos](#pré-requisitos)
- [Instalação e execução](#instalação-e-execução)
- [Configuração e variáveis de ambiente](#configuração-e-variáveis-de-ambiente)
- [Primeiro acesso](#primeiro-acesso)
- [Como usar](#como-usar)
- [API HTTP](#api-http)
- [Modelo de dados](#modelo-de-dados)
- [Como funciona a busca por relevância](#como-funciona-a-busca-por-relevância)
- [Variáveis e placeholders](#variáveis-e-placeholders)
- [Planilhas Excel (.xlsx)](#planilhas-excel-xlsx)
- [Segurança](#segurança)
- [Testes](#testes)
- [Scripts disponíveis](#scripts-disponíveis)
- [Manutenção e operação](#manutenção-e-operação)
- [Limitações conhecidas](#limitações-conhecidas)
- [Licença](#licença)

---

## Visão geral

O FAQ Respostas resolve um problema simples do dia a dia do atendimento: **encontrar rápido a resposta certa e colá-la no canal de atendimento sem retrabalho**.

- O texto é pesquisado por **relevância**, não apenas por “contém”. O título vale mais que o corpo da resposta, acentos e maiúsculas são ignorados, plurais e prefixos são aceitos e palavras genéricas não poluem o resultado.
- A resposta é copiada **no formato do WhatsApp** (`*negrito*`, `_itálico_`, quebras de linha), pronta para colar.
- Cada cópia alimenta um **ranking de uso**: as respostas mais copiadas aparecem primeiro.
- Perguntas podem usar **variáveis** como `{{curso_ads.preco_cheio}}`, atualizadas em um único lugar e refletidas automaticamente em todas as respostas.
- Toda alteração administrativa é registrada em uma **trilha de auditoria** consultável.

### Perfis de acesso

| Perfil | O que pode fazer |
| --- | --- |
| **Admin** | Tudo: buscar, copiar, cadastrar/editar/excluir perguntas, gerenciar variáveis e planilhas, cadastrar/excluir usuários comuns, alterar a própria senha e consultar os logs. |
| **Comum** | Buscar perguntas, abrir respostas e copiar o texto. Não acessa as telas administrativas nem a API de escrita. |

---

## Funcionalidades

### Consulta e atendimento

- **Busca por relevância** com pontuação por campo (título 70% / conteúdo 30%), tolerante a acentos, caixa, plurais e prefixos.
- **Filtro de termos genéricos**: palavras presentes em quase todos os FAQs (ex.: “aluno”, “atendimento”) não geram resultados sozinhas.
- **Ranking de uso**: respostas mais copiadas primeiro; em caso de empate, a mais antiga.
- **Lista inicial enxuta**: sem busca ativa, exibe as 10 perguntas mais copiadas e informa quantas existem no total.
- **Busca com _debounce_** de 250 ms e descarte de respostas antigas que chegam fora de ordem.
- **Cópia em formato WhatsApp**, convertendo o HTML do editor em texto com `*negrito*`, `_itálico_` e quebras de linha.
- **Fallback de cópia** para navegadores/contextos sem `navigator.clipboard` (ex.: acesso por HTTP fora de `localhost`).
- **Contador de cópias com proteção contra abuso**: cada usuário soma no máximo 1 cópia por pergunta a cada 24 h; o texto continua sendo copiado normalmente.

### Administração de perguntas

- CRUD completo de perguntas (criar, listar, editar e excluir), restrito a administradores.
- Editor de texto rico com **Quill 2** (negrito, itálico e limpeza de formatação).
- As respostas são armazenadas em HTML e renderizadas na listagem.
- A busca considera o texto **já com as variáveis substituídas**, ou seja, exatamente o que o atendente vê.
- Administradores recebem também `respostaOriginal` na API, útil para edição sem variáveis aplicadas.

### Variáveis

- Cadastro de variáveis **simples** (`{{nome_da_variavel}}`) e **agrupadas** (`{{linha.coluna}}`).
- Tabela dinâmica com linhas e colunas, adição/remoção, renomeação e reordenação por arrastar e soltar.
- Renomear uma linha/coluna **atualiza automaticamente os marcadores** `{{...}}` nos textos das perguntas.
- **Reajuste percentual em massa** em todas as células preenchidas, com opção de desfazer antes de salvar.
- Busca/filtro na tabela por linha, coluna e valor.
- Aviso de alterações não salvas e de renomeações pendentes.

### Planilhas Excel

- **Exportação `.xlsx`** da tabela agrupada (inclui alterações ainda não salvas e linhas fora do filtro).
- **Importação com prévia**: o arquivo é apenas lido e comparado; nada é gravado até o usuário aplicar e clicar em **Salvar variáveis**.
- Detecção de novas linhas/colunas, células alteradas e células vazias, com opções para criar/limpar.
- Validação de estrutura, nomes, limites de tamanho e fórmulas/erros de célula, com avisos amigáveis.
- Aba **Instrucoes** gerada no arquivo exportado explicando o formato.

### Usuários e auditoria

- Cadastro de usuários com perfis **admin** e **comum**, senha mínima de 6 caracteres.
- Senhas armazenadas com **PBKDF2-SHA512** (120.000 iterações + salt aleatório).
- Somente usuários **comuns** podem ser excluídos; administradores nunca são removidos pela interface.
- Alteração da própria senha (validando a senha atual).
- **Logs de auditoria** de perguntas, variáveis e usuários, com filtros por texto, usuário, entidade, ação e período, além de paginação.
- Visualização campo a campo do que mudou (antes/depois) e do JSON completo de cada registro.

---

## Stack tecnológica

| Camada | Tecnologia |
| --- | --- |
| Runtime | **Node.js** `>= 20.17` (ES Modules, `node --test`) |
| Servidor HTTP | **Express 5** |
| Templates | **EJS 6** |
| ORM | **Sequelize 6** |
| Banco de dados | **SQLite 3** (arquivo local `database.sqlite`) |
| Planilhas | **ExcelJS 4** |
| Front-end | **Vue 3** (CDN), **Bootstrap 5.3** (CDN), **Quill 2** (CDN) |
| Autenticação | Cookie assinado com **HMAC-SHA256** (módulo nativo `crypto`) |
| Senhas | **PBKDF2-SHA512** (módulo nativo `crypto`) |
| Testes | **Node.js Test Runner** (`node:test` + `node:assert/strict`) |

> O front-end não passa por build: as bibliotecas são carregadas por CDN e os arquivos de `src/public` são servidos diretamente pelo Express.

---

## Arquitetura

```text
┌──────────────────────────────────────────────────────────────────┐
│ Navegador                                                        │
│  Vue 3 + Bootstrap 5 + Quill 2 (CDN)                             │
└───────────────┬──────────────────────────────────────────────────┘
                │ HTTP (HTML/EJS, JSON e .xlsx)
                ▼
┌──────────────────────────────────────────────────────────────────┐
│ Express 5 — src/index.js                                         │
│  ├─ express.json / urlencoded (limite 2 MB)                      │
│  ├─ express.static (src/public)                                  │
│  ├─ Rotas públicas: /login                                       │
│  ├─ Middleware autenticar (cookie HMAC)                          │
│  ├─ Rotas protegidas + exigirAdmin nas escritas administrativas  │
│  └─ Views EJS (src/views)                                        │
└───────────────┬──────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────┐
│ Controllers — regras de negócio e validações                     │
│  auth · pergunta · variavel · usuario · log                      │
└───────────────┬──────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────┐
│ Models (Sequelize) + Utils                                       │
│  buscaRelevancia · substituirVariavel · renomearVariaveis        │
│  planilhaVariaveis · logAlteracao · authToken · senha            │
└───────────────┬──────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────┐
│ SQLite — ./database.sqlite                                       │
│  Pergunta · Variavels · Usuarios · logs · copias_perguntas       │
└──────────────────────────────────────────────────────────────────┘
```

### Fluxo de uma consulta

1. O usuário faz login em `/login`; o servidor valida a senha com PBKDF2 e grava o cookie `faq_auth` assinado.
2. A tela `/buscar/perguntas` carrega `GET /api/perguntas`, que devolve as perguntas ordenadas por cópias e já com as variáveis substituídas.
3. Ao digitar, o front-end chama `GET /api/perguntas/busca?q=...` após 250 ms sem novas teclas.
4. O controller carrega as perguntas e variáveis, aplica `substituirVariaveis` e entrega os documentos ao motor `buscarPorRelevancia`.
5. O motor tokeniza, remove HTML, calcula IDF/raridade, pontua título e conteúdo e devolve apenas resultados acima do score mínimo.
6. Ao copiar, o front-end converte o HTML para texto de WhatsApp e chama `POST /api/perguntas/:id/copiar`; o servidor contabiliza no máximo uma cópia por usuário/pergunta em 24 h.
7. Toda operação administrativa grava um registro em `logs` com usuário, ação, descrição e snapshots antes/depois.

---

## Estrutura de pastas

```text
faq-respostas/
├── src/
│   ├── index.js                    # bootstrap do Express, middlewares e rotas
│   ├── config/
│   │   └── database.js             # conexão Sequelize com o SQLite
│   ├── database/
│   │   └── sync.js                 # sync das tabelas, colunas de compatibilidade e admin inicial
│   ├── controllers/
│   │   ├── authController.js       # login, formulário e logout
│   │   ├── perguntaController.js   # CRUD, busca e registro de cópias
│   │   ├── variavelControoler.js   # variáveis, tabela, importação e exportação
│   │   ├── usuarioController.js    # usuários e troca de senha
│   │   └── logController.js        # filtros, paginação e detalhes dos logs
│   ├── middlewares/
│   │   └── authMiddleware.js       # autenticar, exigirAdmin, redirecionarSeAutenticado
│   ├── models/
│   │   ├── PerguntaModel.js        # Pergunta
│   │   ├── VariavelModel.js        # Variavel
│   │   ├── UsuarioModel.js         # Usuario
│   │   ├── LogModel.js             # LogAlteracao (tabela logs)
│   │   └── CopiaPerguntaModel.js   # CopiaPergunta (tabela copias_perguntas)
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── perguntaRoutes.js
│   │   ├── variavelRoutes.js
│   │   ├── usuarioRoutes.js
│   │   └── logRoutes.js
│   ├── utils/
│   │   ├── authToken.js            # token HMAC e helpers de cookie
│   │   ├── senha.js                # PBKDF2-SHA512
│   │   ├── buscaRelevancia.js      # motor de busca e pontuação
│   │   ├── substituirVariavel.js   # troca {{marcadores}} pelos valores
│   │   ├── renomearVariaveis.js    # propagação de renomeações nos textos
│   │   ├── planilhaVariaveis.js    # leitura/escrita de .xlsx com ExcelJS
│   │   └── logAlteracao.js         # gravação tolerante a falhas dos logs
│   ├── public/
│   │   ├── css/app.css
│   │   └── js/
│   │       ├── perguntas.js        # app Vue da busca
│   │       └── cadastroVariaveis.js# app Vue da tabela de variáveis
│   └── views/
│       ├── login.ejs
│       ├── perguntas.ejs
│       ├── cadastrarVariaveis.ejs
│       ├── usuarios.ejs
│       └── logs.ejs
├── tests/
│   └── buscaRelevancia.test.js     # 14 testes do motor de busca
├── database.sqlite                 # gerado em runtime (não versionado)
├── package.json
├── package-lock.json
└── README.md
```

---

## Pré-requisitos

- **Node.js `>= 20.17`** (exigência do driver `sqlite3` 6). Recomenda-se a versão LTS atual.
- **npm** (incluído no Node.js).
- Navegador moderno com suporte a ES2020, `fetch` e (preferencialmente) `navigator.clipboard`.
- Acesso à internet no navegador para os CDNs de Bootstrap, Vue e Quill.

Verifique a versão instalada:

```bash
node --version
npm --version
```

---

## Instalação e execução

Na raiz do projeto:

```bash
# 1. Instalar dependências
npm install

# 2. Subir o servidor
npm start
```

A saída esperada é semelhante a:

```text
Usuário inicial criado. Login: admin | Senha: admin123
Banco de dados conectado e tabelas sincronizadas.
Servidor rodando em http://localhost:3000
```

Abra **[http://localhost:3000](http://localhost:3000)** — você será redirecionado para `/login`.

> O banco `database.sqlite` é criado automaticamente na raiz do projeto. O servidor deve ser iniciado a partir da raiz, pois o caminho do SQLite (`./database.sqlite`) é relativo ao diretório de execução.

Para desenvolvimento com recarga automática, use o modo _watch_ nativo do Node:

```bash
node --watch src/index.js
```

---

## Configuração e variáveis de ambiente

O projeto **não carrega `.env` automaticamente** (não há `dotenv`). Defina as variáveis no ambiente antes de iniciar o processo.

| Variável | Obrigatória | Valor padrão | Descrição |
| --- | --- | --- | --- |
| `AUTH_SECRET` | **Recomendada** | `troque-este-segredo-em-producao` | Segredo usado para assinar o cookie de sessão (HMAC-SHA256). Troque em qualquer ambiente real. |
| `ADMIN_LOGIN` | Não | `admin` | Login do administrador criado automaticamente **apenas quando não existe nenhum usuário**. |
| `ADMIN_PASSWORD` | Não | `admin123` | Senha do administrador inicial. Usada somente na primeira inicialização. |

Exemplo no **PowerShell**:

```powershell
$env:AUTH_SECRET = 'uma-frase-longa-e-aleatoria'
$env:ADMIN_LOGIN = 'admin'
$env:ADMIN_PASSWORD = 'minha-senha-inicial-forte'
npm start
```

Exemplo em **Bash**:

```bash
AUTH_SECRET='uma-frase-longa-e-aleatoria' \
ADMIN_LOGIN='admin' \
ADMIN_PASSWORD='minha-senha-inicial-forte' \
npm start
```

> A porta **3000** está fixa em `src/index.js`. Para alterá-la, edite a constante `PORT` (ou adapte o arquivo para ler `process.env.PORT`).

---

## Primeiro acesso

1. Inicie o servidor e abra `http://localhost:3000`.
2. Entre com o usuário criado no primeiro boot:
   - **Login:** `admin`
   - **Senha:** `admin123`
   - (ou os valores definidos em `ADMIN_LOGIN` / `ADMIN_PASSWORD` antes da primeira execução)
3. Vá em **Usuários → Alterar minha senha** e troque a senha inicial imediatamente.
4. Cadastre os usuários de atendimento com o perfil **Comum**.
5. Cadastre as perguntas em **Nova pergunta** e, se necessário, as variáveis em **Variáveis**.

---

## Como usar

### Buscar e copiar uma resposta

1. Na tela **FAQ - Puc Goiás CAD**, digite o assunto no campo de busca (ex.: “segunda via boleto”).
2. A lista é atualizada automaticamente após uma pequena pausa na digitação.
3. Abra o item desejado no acordeão.
4. Clique em **Copiar**. O texto vai para a área de transferência já no formato do WhatsApp:
   - `<strong>` / `<b>` → `*texto*`
   - `<em>` / `<i>` → `_texto_`
   - `<br>` e parágrafos → quebras de linha
5. O botão confirma com **Copiado!** e a cópia é contabilizada no ranking (respeitando o limite de 1 por usuário/pergunta/24 h).

Sem busca ativa, a tela mostra as **10 perguntas mais copiadas**. O badge indica quantas existem no total; use a busca para acessar as demais.

### Administrar perguntas

1. Clique em **Nova pergunta**.
2. Informe o **título** (o que o atendente vai pesquisar) e a **resposta** no editor.
3. Use os botões **Editar** e **Excluir** em cada item para manter o conteúdo.
4. Para inserir variáveis, use o formato `{{linha.coluna}}` ou `{{nome}}` no texto da resposta.

### Administrar variáveis

1. Acesse **Variáveis** no cabeçalho.
2. Em **Estrutura da tabela**, adicione as linhas (ex.: `curso_ads`) e colunas (ex.: `preco_cheio`).
3. Preencha as células. Cada célula gera automaticamente o marcador `{{linha.coluna}}` exibido abaixo do campo.
4. Use **Reajuste em percentual** para aplicar um percentual em massa (negativo reduz), com opção de desfazer.
5. Clique em **Salvar variáveis**. Se houver renomeações, os textos das perguntas são atualizados automaticamente.
6. Variáveis simples continuam disponíveis na seção **Variáveis simples**, no formato `{{nome_da_variavel}}`.

### Consultar logs

1. Acesse **Logs** (somente admin).
2. Filtre por texto livre, usuário, entidade, ação e período.
3. Abra os detalhes para ver campo a campo o que mudou, além do JSON completo de antes/depois.
4. A listagem é paginada em 50 registros por página.

---

## API HTTP

Todas as rotas abaixo, exceto `GET`/`POST /login` e `POST /logout`, exigem sessão válida (cookie `faq_auth`). As marcadas como **Admin** retornam `403` para usuários comuns (ou redirecionam para o FAQ, no caso de navegação HTML).

### Autenticação

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `GET` | `/login` | Público | Formulário de login (redireciona se já autenticado). |
| `POST` | `/login` | Público | Autentica com `login` e `senha` (form urlencoded) e grava o cookie. |
| `POST` | `/logout` | Público | Remove o cookie e redireciona para `/login`. |

### Perguntas

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `GET` | `/buscar/perguntas` | Autenticado | Página principal do FAQ. |
| `GET` | `/api/perguntas` | Autenticado | Lista perguntas ordenadas por cópias; aplica variáveis. |
| `GET` | `/api/perguntas/busca?q=termo` | Autenticado | Busca por relevância. Retorna `[]` para consulta vazia. |
| `POST` | `/api/perguntas/:id/copiar` | Autenticado | Registra a cópia (máx. 1 por usuário/pergunta/24 h). |
| `POST` | `/api/perguntas` | **Admin** | Cria pergunta (`titulo`, `resposta`). |
| `PUT` | `/api/perguntas/:id` | **Admin** | Atualiza pergunta (`titulo`, `resposta`). |
| `DELETE` | `/api/perguntas/:id` | **Admin** | Exclui pergunta. |

### Variáveis

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `GET` | `/cadastrar/variavel` | **Admin** | Página da tabela de variáveis. |
| `GET` | `/api/variavel` | **Admin** | Lista variáveis em ordem alfabética. |
| `POST` | `/api/variavel` | **Admin** | Cria variável simples (`nome`, `valor`). |
| `PUT` | `/api/variavel/:id` | **Admin** | Atualiza o valor de uma variável. |
| `PUT` | `/api/variavel/tabela` | **Admin** | Salva a tabela inteira (`variaveis`, `renomeacoes`). |
| `POST` | `/api/variavel/tabela/exportar` | **Admin** | Gera e devolve o `.xlsx` a partir de `linhas`/`colunas` da tela. |
| `POST` | `/api/variavel/tabela/importar` | **Admin** | Lê o `.xlsx` cru (corpo binário, até 5 MB) e devolve a prévia. Não grava. |

### Usuários e logs

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `GET` | `/usuarios` | **Admin** | Página de gestão de usuários. |
| `POST` | `/usuarios` | **Admin** | Cria usuário (`nome`, `login`, `senha`, `tipo`). |
| `POST` | `/usuarios/:id/excluir` | **Admin** | Exclui um usuário **comum**. |
| `POST` | `/usuarios/minha-senha` | **Admin** | Altera a própria senha (`senhaAtual`, `novaSenha`). |
| `GET` | `/logs` | **Admin** | Página de auditoria com filtros e paginação. |

Filtros aceitos em `/logs`: `busca`, `usuario`, `entidade` (`pergunta`, `variavel`, `usuario`), `acao` (`criar`, `atualizar`, `excluir`, `salvar`, `senha`), `dataInicio`, `dataFim` (formato `AAAA-MM-DD`) e `pagina`.

### Exemplo rápido com cURL

```bash
# 1. Autenticar e guardar o cookie
curl -c cookies.txt -X POST http://localhost:3000/login \
  -d "login=admin&senha=admin123"

# 2. Buscar perguntas
curl -b cookies.txt "http://localhost:3000/api/perguntas/busca?q=boleto"

# 3. Registrar a cópia da resposta de id 1
curl -b cookies.txt -X POST http://localhost:3000/api/perguntas/1/copiar
```

Resposta do registro de cópia:

```json
{
  "id": 1,
  "copias": 7,
  "contabilizada": true
}
```

`contabilizada: false` indica que o limite de 24 h já havia sido atingido para aquele usuário naquela pergunta.

---

## Modelo de dados

### `Perguntas`

| Campo | Tipo | Observações |
| --- | --- | --- |
| `id` | INTEGER | Chave primária, autoincremento. |
| `titulo` | STRING | Obrigatório. É o campo com maior peso na busca. |
| `resposta` | TEXT | Obrigatório. Armazena HTML do editor Quill e pode conter `{{marcadores}}`. |
| `ativo` | BOOLEAN | Padrão `true`. |
| `copias` | INTEGER | Padrão `0`. Contador usado no ranking. |
| `createdAt` / `updatedAt` | DATETIME | Timestamps do Sequelize. |

### `Variavels`

| Campo | Tipo | Observações |
| --- | --- | --- |
| `id` | INTEGER | Chave primária. |
| `nome` | STRING | Único e obrigatório. Nome simples ou `linha.coluna`. |
| `valor` | TEXT | Valor substituído nos textos. |
| `createdAt` / `updatedAt` | DATETIME | Timestamps. |

> A linha reservada `__ORDEM_VARIAVEIS__` guarda, em JSON, a estrutura visível da tabela (`{ linhas, colunas, simples }`). Ela não aparece na interface e não deve ser editada manualmente.

### `Usuarios`

| Campo | Tipo | Observações |
| --- | --- | --- |
| `id` | INTEGER | Chave primária. |
| `nome` | STRING | Obrigatório. |
| `login` | STRING | Único e obrigatório. |
| `senhaHash` | TEXT | Hash PBKDF2-SHA512 no formato `iterações:salt:hash`. |
| `tipo` | STRING | `admin` ou `comum` (validado no model). |
| `ativo` | BOOLEAN | Padrão `true`. |
| `createdAt` / `updatedAt` | DATETIME | Timestamps. |

### `logs`

| Campo | Tipo | Observações |
| --- | --- | --- |
| `id` | INTEGER | Chave primária. |
| `usuarioId` | INTEGER | Pode ser nulo (registros sem usuário identificado). |
| `usuarioNome` / `usuarioLogin` | STRING | Snapshot de quem executou a ação. |
| `entidade` | STRING | `pergunta`, `variavel` ou `usuario`. |
| `acao` | STRING | `criar`, `atualizar`, `excluir`, `salvar` ou `senha`. |
| `registroId` | STRING | ID do registro afetado (string para acomodar IDs compostos). |
| `descricao` | TEXT | Texto legível do que aconteceu. |
| `dadosAnteriores` / `dadosNovos` | TEXT | JSON com os snapshots antes e depois. |
| `createdAt` / `updatedAt` | DATETIME | Timestamps. |

### `copias_perguntas`

| Campo | Tipo | Observações |
| --- | --- | --- |
| `id` | INTEGER | Chave primária. |
| `perguntaId` | INTEGER | Pergunta copiada. |
| `usuarioId` | INTEGER | Usuário que copiou. |
| `createdAt` / `updatedAt` | DATETIME | `createdAt` é usado na janela de 24 h. |

Índice: `idx_copias_pergunta_usuario_data` em (`perguntaId`, `usuarioId`, `createdAt`).

> As tabelas são criadas automaticamente por `src/database/sync.js` no boot, que também adiciona as colunas de compatibilidade `Usuarios.tipo` e `Perguntas.copias` quando necessário. Não há migrations versionadas.

---

## Como funciona a busca por relevância

O motor fica em `src/utils/buscaRelevancia.js` e não usa biblioteca externa.

1. **Normalização** — remove tags HTML, decodifica entidades, converte para minúsculas e remove acentos.
2. **Tokenização** — separa palavras, descarta termos muito curtos e aplica um filtro de termos genéricos (ex.: “como”, “para”, “qual”), que teriam peso indevido por aparecerem em tudo.
3. **Tolerância** — aceita plural/singular, prefixos e pequenos radicais, evitando exigir correspondência exata.
4. **Raridade (IDF)** — termos que aparecem em poucas perguntas recebem peso maior, no estilo TF-IDF.
5. **Pontuação** — cada documento recebe **70% de peso pelo título** e **30% pelo conteúdo**.
6. **Corte** — só entram resultados com score acima do mínimo, e a lista é ordenada do mais relevante para o menos relevante.

A consulta vazia retorna `[]`; o front-end, nesse caso, volta a exibir as mais copiadas. A busca é disparada com _debounce_ de **250 ms**.

Exemplo de teste coberto pela suíte: buscar `boleto` deve priorizar a pergunta cujo título menciona “boleto”, mesmo que outra resposta cite a palavra várias vezes no corpo.

---

## Variáveis e placeholders

Dois formatos são suportados em qualquer texto de pergunta:

| Formato | Uso | Exemplo |
| --- | --- | --- |
| `{{nome}}` | Variável simples | `O prazo é de {{prazo_matricula}} dias úteis.` |
| `{{linha.coluna}}` | Valor de célula da tabela | `O curso de {{curso.nome}} custa {{curso.preco}}.` |

Regras práticas:

- No cadastro pela tela e na importação, nomes são normalizados para usar apenas `A-Z`, `a-z`, `0-9` e `_` (sem espaços ou acentos).
- A substituição ocorre **no momento da leitura** (`GET /api/perguntas`, `GET /api/perguntas/busca`), portanto alterar o valor de uma variável já reflete em todas as respostas.
- Marcadores sem valor correspondente são mantidos no texto para não esconder conteúdo faltante.
- Ao renomear uma linha, coluna ou variável simples na tela de variáveis, o utilitário `renomearVariaveis.js` percorre as perguntas e reescreve os marcadores antigos.
- O nome da linha/coluna é validado e normalizado (acentos removidos, espaços convertidos em `_`) antes de ser salvo.

---

## Planilhas Excel (.xlsx)

A tela de variáveis permite levar a tabela para o Excel, editar em lote e trazer de volta.

### Exportar

- Botão **Exportar planilha** → `POST /api/variavel/tabela/exportar`.
- O arquivo gerado chama-se `variaveis-agrupadas-AAAA-MM-DD-HHMM.xlsx`.
- Aba **Variaveis**: primeira coluna `linha` (nomes das linhas) e uma coluna por coluna da tabela, com cabeçalho congelado, autofiltro e formatação de números no padrão `1.234,56`.
- Aba **Instrucoes**: explica o formato, as regras de nomes e o passo a passo de reimportação.
- A exportação inclui o estado atual da tela, inclusive alterações ainda não salvas e linhas escondidas pelo filtro.

### Importar

- Botão **Importar planilha** → `POST /api/variavel/tabela/importar` (corpo binário do `.xlsx`, `Content-Type` livre, limite de **5 MB**).
- O servidor **não grava nada**: devolve uma prévia com:
  - linhas e colunas novas;
  - células alteradas (valor atual × valor da planilha);
  - células vazias na planilha;
  - avisos de normalização de nomes e células ignoradas.
- Na tela, o admin escolhe aplicar a prévia, definir se células vazias limpam o valor e então clica em **Salvar variáveis** para persistir.
- Linhas/colunas existentes que não aparecem na planilha são **mantidas** (nada é apagado por omissão).
- Reordenar linhas/colunas na planilha não altera a ordem da tabela na tela.

### Limites e validações

| Item | Limite/regra |
| --- | --- |
| Tamanho do arquivo | 5 MB |
| Linhas de dados | 2.000 |
| Colunas de valores | 200 |
| Células totais | 40.000 |
| Texto por célula | 5.000 caracteres |
| Avisos retornados | 40 |
| Formato | Apenas `.xlsx` (não `.xls`, `.csv` ou planilha protegida por senha) |
| Cabeçalho | `A1` precisa ser `linha`; nomes de colunas devem ser únicos e usar `A-Z`, `a-z`, `0-9`, `_` |
| Fórmulas/erros | Células com fórmula sem resultado ou erro (`#REF!`, `#VALUE!`…) geram aviso e são ignoradas |

> A leitura usa a aba `Variaveis`; se ela não existir, tenta a primeira aba do arquivo. Células mescladas e múltiplas abas de dados não são suportadas.

---

## Segurança

| Tema | Implementação |
| --- | --- |
| Sessão | Cookie `faq_auth` com payload em Base64URL + assinatura **HMAC-SHA256**, comparada com `crypto.timingSafeEqual`. |
| Expiração | Token e cookie expiram em **8 horas** (`maxAge`). |
| Atributos do cookie | `HttpOnly` e `SameSite=Lax`. |
| Validação por requisição | O middleware relê o usuário no banco e exige `ativo = true`, então desativar/excluir um usuário invalida o acesso. |
| Autorização | `exigirAdmin` protege todas as rotas de escrita administrativa; usuários comuns recebem `403` (JSON) ou redirecionamento (HTML). |
| Senhas | **PBKDF2-SHA512**, 120.000 iterações, salt aleatório de 16 bytes e chave de 64 bytes; comparação em tempo constante. |
| Força da senha | Mínimo de 6 caracteres no cadastro e na troca. |
| Exclusão de usuários | Apenas usuários do tipo `comum` podem ser excluídos pela interface. |
| Auditoria | Toda escrita administrativa relevante gera registro em `logs` com autor e snapshots. |
| Upload | Limite de 5 MB, leitura do binário como `.xlsx` e limites de linhas/colunas/células. |
| Segredos | Não há credenciais no código além dos padrões de desenvolvimento; `AUTH_SECRET` deve ser definido no ambiente. |

### Recomendações para produção

1. Defina `AUTH_SECRET` com um valor longo e aleatório (ex.: `openssl rand -base64 48`).
2. Sirva a aplicação atrás de **HTTPS** e adicione `secure: true` ao cookie em `authToken.js`.
3. Troque a senha do admin inicial e remova/limite os usuários de teste.
4. Restrinja o acesso à rede interna (VPN/reverse proxy com autenticação, se necessário).
5. Faça backup periódico do arquivo `database.sqlite` (ver [Manutenção e operação](#manutenção-e-operação)).
6. Não exponha a porta 3000 diretamente na internet.

---

## Testes

A suíte cobre o motor de busca e roda com o test runner nativo do Node (sem dependências de teste):

```bash
npm test
```

Resultado esperado: **14 testes aprovados**.

```text
✔ pesos dos campos seguem a regra 70% titulo / 30% conteudo
✔ normalizacao remove acentos, caixa e pontuacao
✔ htmlParaTexto descarta tags, scripts e decodifica entidades
✔ consulta vazia, sem termos uteis ou acervo vazio nao retorna resultados
✔ campo nulo ou ausente nao quebra a busca
✔ termo no titulo vale mais que o mesmo termo apenas no corpo
✔ busca encontra termos apenas no corpo HTML da resposta
✔ resultados sao ordenados pela quantidade de termos encontrados
✔ palavra generica presente em todos os FAQs nao gera resultados
✔ palavra generica combinada com termo especifico filtra os irrelevantes
✔ busca ignora acentos, caixa e aceita prefixo/plural
✔ nome de tag ou atributo HTML nao e pesquisavel
✔ empate de relevancia usa o ranking de copias e depois o id
✔ scores retornados ficam entre o minimo e 1 e em ordem decrescente
```

Os testes ficam em `tests/buscaRelevancia.test.js` e importam diretamente `src/utils/buscaRelevancia.js` (funções puras, sem banco). O `node --test` descobre automaticamente arquivos `*.test.js`.

---

## Scripts disponíveis

| Comando | O que faz |
| --- | --- |
| `npm start` | Inicia o servidor (`node src/index.js`) em `http://localhost:3000`. |
| `npm test` | Executa todos os testes (`node --test`). |
| `node --watch src/index.js` | Modo desenvolvimento com recarga automática. |

Não há scripts de build, lint ou migrations: o front-end usa CDN e o schema é sincronizado no boot.

---

## Manutenção e operação

### Backup

O estado inteiro está em `database.sqlite`. Para um backup consistente:

1. Pare o servidor (ou faça a cópia em momento de baixa atividade).
2. Copie o arquivo `database.sqlite` para um local seguro, com data no nome.
3. Guarde também o valor atual de `AUTH_SECRET` (sem ele, os cookies existentes deixam de valer, mas as senhas continuam funcionando).

```powershell
Copy-Item -LiteralPath '.\database.sqlite' -Destination ".\backup-database-$(Get-Date -Format 'yyyy-MM-dd-HHmm').sqlite"
```

### Restauração

1. Pare o servidor.
2. Substitua `database.sqlite` pelo backup.
3. Inicie novamente com o mesmo `AUTH_SECRET`.

### Atualização de versão

1. Faça backup do banco.
2. Atualize o código e rode `npm install`.
3. Inicie o servidor: `sync.js` cria as tabelas que faltarem, garante as colunas `Usuarios.tipo` e `Perguntas.copias` e preserva os dados existentes.
4. Rode `npm test` para validar o motor de busca.

> `sync.js` usa `sequelize.sync()` **sem `alter`**. Novas colunas previstas nos models (além das duas garantidas explicitamente) não são adicionadas automaticamente a um banco já existente; nesses casos, faça backup e altere o schema manualmente.

### Limpeza opcional de logs e cópias antigas

Com o servidor parado, use o `sqlite3` (ou uma ferramenta gráfica) para apagar registros antigos:

```sql
-- logs com mais de 1 ano
DELETE FROM logs WHERE createdAt < datetime('now', '-1 year');

-- histórico de cópias com mais de 90 dias (o contador `copias` das perguntas é preservado)
DELETE FROM copias_perguntas WHERE createdAt < datetime('now', '-90 days');
```

### Monitoramento básico

- Acompanhe o console do processo: erros de banco e de planilha são registrados com `console.error`.
- Verifique periodicamente a tela **Logs** para identificar alterações inesperadas.
- Monitore o tamanho de `database.sqlite`; crescimento anormal costuma vir da tabela `logs`.

---

## Limitações conhecidas

- **SQLite em arquivo único**: adequado ao uso interno de baixo/médio volume, mas não a múltiplas instâncias concorrentes.
- **Porta fixa 3000**: não há leitura de `process.env.PORT`.
- **Sem `.env`**: a configuração é feita apenas por variáveis de ambiente do processo.
- **Sem migrations versionadas**: a evolução do schema depende de `sync.js` ou de intervenção manual.
- **Sem proteção CSRF explícita** nas rotas de formulário/JSON; a mitigação atual é o cookie `SameSite=Lax` e o uso em rede interna.
- **Sem rate limiting** no login nem bloqueio por tentativas repetidas.
- **Cookie sem `Secure` por padrão**: em produção, sirva via HTTPS e habilite o atributo.
- **Sem recuperação de senha por e-mail**: um admin pode criar um novo usuário, mas não redefinir a senha de outro pela interface.
- **Sem exclusão de administradores** pela interface (proteção intencional).
- **Front-end dependente de CDN**: sem internet no navegador, os estilos e o editor não carregam.
- **HTML das respostas é confiado ao admin**: o conteúdo do editor é renderizado como HTML; apenas administradores podem criá-lo.
- **Cobertura de testes restrita ao motor de busca**: controllers, rotas, autenticação e planilhas não têm testes automatizados.
- **Listagem inicial limitada a 10 itens**: perguntas fora do ranking só aparecem pela busca.
- **Ranking por cópias**: o contador `copias` não é recalculado se registros de `copias_perguntas` forem apagados.

---

## Licença

Distribuído sob a licença **ISC**, conforme declarado em `package.json`. O repositório não inclui um arquivo `LICENSE` próprio; para uso externo ou redistribuição, confirme a autorização com a equipe responsável pelo projeto na PUC Goiás CAD.
