const { createApp } = Vue;

//quantidade maxima de itens exibidos sem filtro ativo (os demais aparecem pela busca)
const LIMITE_EXIBICAO = 20;

createApp({
    data() {
        return {
            variaveis: [],
            linhas: [],
            colunas: [],
            simples: [],
            novaLinha: '',
            novaColuna: '',
            novoSimples: {
                nome: '',
                valor: ''
            },
            proximoId: 1,
            colunaEmEdicao: '',
            filtro: '',
            filtroSimples: '',
            carregando: true,
            salvando: false,
            alteracoesPendentes: false,
            estadoSalvo: '',
            nomeVariavelOrdem: '__ORDEM_VARIAVEIS__',
            arrastoLinhaId: null,
            arrastoColunaIndex: null,
            linhaAdicionadaId: null,
            reajustePercentual: '',
            mensagemReajuste: '',
            ultimoReajuste: null,
            exportando: false,
            importando: false,
            dadosImportacao: null,
            erroImportacao: '',
            mensagemImportacao: '',
            mensagemExportacao: '',
            ultimaImportacao: null,
            importarNovasLinhas: true,
            importarNovasColunas: true,
            limparCelulasVazias: false,
            exemplo_placeholder: '{{curso_ads.preco_cheio}}',
            avisoCopia: {
                mensagem: '',
                erro: false
            },
            temporizadorCopia: null
        };
    },

    computed: {
        linhasFiltradas() {
            const termo = this.normalizarTexto(this.filtro);

            //sem filtro: limita a quantidade de linhas exibidas na tela
            if (!termo) {
                const visiveis = this.linhas.slice(0, LIMITE_EXIBICAO);
                const linhaAdicionada = this.linhas.find(linha => (
                    linha._id === this.linhaAdicionadaId
                ));

                //garante que a linha recem-criada apareca mesmo fora da janela exibida
                if (linhaAdicionada && !visiveis.includes(linhaAdicionada)) {
                    visiveis.push(linhaAdicionada);
                }

                return visiveis;
            }

            //com filtro: exibe todos os resultados (ignora acentos e maiusculas)
            return this.linhas.filter(linha => {
                if (this.normalizarTexto(linha.nome).includes(termo)) {
                    return true;
                }

                return this.colunas.some(coluna => {
                    const valor = linha.valores[coluna] || '';

                    return this.normalizarTexto(coluna).includes(termo)
                        || this.normalizarTexto(valor).includes(termo);
                });
            });
        },

        simplesFiltradas() {
            const termo = this.normalizarTexto(this.filtroSimples);

            //sem filtro: limita a quantidade de variaveis exibidas na tela
            if (!termo) {
                return this.simples.slice(0, LIMITE_EXIBICAO);
            }

            //com filtro: exibe todos os resultados (ignora acentos e maiusculas)
            return this.simples.filter(variavel => (
                this.normalizarTexto(variavel.nome).includes(termo)
                || this.normalizarTexto(variavel.valor).includes(termo)
                || this.normalizarTexto(this.placeholderSimples(variavel.nome)).includes(termo)
            ));
        },

        avisoLinhas() {
            const total = this.linhas.length;
            const exibidas = this.linhasFiltradas.length;

            if (this.normalizarTexto(this.filtro)) {
                return exibidas === 1
                    ? '1 linha encontrada para a busca.'
                    : `${exibidas} linhas encontradas para a busca.`;
            }

            if (total > LIMITE_EXIBICAO) {
                return `Mostrando as ${LIMITE_EXIBICAO} primeiras linhas de ${total}. Use a busca para encontrar as demais.`;
            }

            return '';
        },

        avisoSimples() {
            const total = this.simples.length;
            const exibidas = this.simplesFiltradas.length;

            if (this.normalizarTexto(this.filtroSimples)) {
                return exibidas === 1
                    ? '1 variavel encontrada para a busca.'
                    : `${exibidas} variaveis encontradas para a busca.`;
            }

            if (total > LIMITE_EXIBICAO) {
                return `Mostrando as ${LIMITE_EXIBICAO} primeiras variaveis de ${total}. Use a busca para encontrar as demais.`;
            }

            return '';
        },

        //previa da importacao: compara o arquivo lido com o estado atual da tabela
        resumoImportacao() {
            if (!this.dadosImportacao) {
                return null;
            }

            const dados = this.dadosImportacao;
            const colunasAtuais = new Map();
            const linhasAtuais = new Map();

            this.colunas.forEach(coluna => {
                colunasAtuais.set(this.normalizarIdentificador(coluna), coluna);
            });

            this.linhas.forEach(linha => {
                linhasAtuais.set(this.normalizarIdentificador(linha.nome), linha);
            });

            const colunasDoArquivo = dados.colunas
                .map(coluna => ({ arquivo: coluna, atual: colunasAtuais.get(coluna) ?? null }));

            const novasColunas = colunasDoArquivo
                .filter(coluna => coluna.atual === null)
                .map(coluna => coluna.arquivo);

            const linhasDoArquivo = dados.linhas
                .map(linha => ({ arquivo: linha, atual: linhasAtuais.get(linha.nome) ?? null }));

            const novasLinhas = linhasDoArquivo
                .filter(linha => linha.atual === null)
                .map(linha => linha.arquivo);

            const nomesNoArquivo = new Set(dados.linhas.map(linha => linha.nome));
            const linhasAusentes = this.linhas
                .filter(linha => !nomesNoArquivo.has(this.normalizarIdentificador(linha.nome)))
                .map(linha => linha.nome);

            const alteracoes = [];
            const celulasVazias = [];

            linhasDoArquivo.forEach(({ arquivo, atual }) => {
                if (!atual) {
                    return;
                }

                colunasDoArquivo.forEach(({ arquivo: colunaArquivo, atual: colunaAtual }) => {
                    if (!colunaAtual) {
                        return;
                    }

                    const valorAtual = String(atual.valores[colunaAtual] ?? '').trim();
                    const celula = arquivo.valores[colunaArquivo];

                    if (!celula) {
                        if (valorAtual) {
                            celulasVazias.push({
                                linha: atual.nome,
                                coluna: colunaAtual,
                                variavel: `${atual.nome}.${colunaAtual}`,
                                antes: valorAtual
                            });
                        }

                        return;
                    }

                    const novoValor = this.valorDaCelulaImportada(celula);

                    if (this.valoresEquivalentes(valorAtual, novoValor)) {
                        return;
                    }

                    alteracoes.push({
                        linha: atual.nome,
                        coluna: colunaAtual,
                        variavel: `${atual.nome}.${colunaAtual}`,
                        antes: valorAtual,
                        depois: novoValor
                    });
                });
            });

            const podeAplicar = alteracoes.length > 0
                || (this.importarNovasLinhas && novasLinhas.length > 0)
                || (this.importarNovasColunas && novasColunas.length > 0)
                || (this.limparCelulasVazias && celulasVazias.length > 0);

            return {
                arquivo: dados.arquivo,
                aba: dados.aba,
                totalLinhas: dados.linhas.length,
                totalColunas: dados.colunas.length,
                avisos: dados.avisos || [],
                alteracoes,
                alteracoesVisiveis: alteracoes.slice(0, 200),
                celulasVazias,
                celulasVaziasVisiveis: celulasVazias.slice(0, 200),
                novasLinhas,
                novasColunas,
                linhasAusentes,
                podeAplicar
            };
        }
    },

    watch: {
        linhas: {
            deep: true,
            handler() {
                this.verificarAlteracoesPendentes();
            }
        },

        colunas: {
            deep: true,
            handler() {
                this.verificarAlteracoesPendentes();
            }
        },

        simples: {
            deep: true,
            handler() {
                this.verificarAlteracoesPendentes();
            }
        }
    },

    methods: {
        normalizarTexto(valor) {
            return String(valor || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .trim();
        },

        normalizarIdentificador(valor) {
            return String(valor || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim()
                .replace(/[^A-Za-z0-9_]+/g, '_')
                .replace(/^_+|_+$/g, '')
                .replace(/_+/g, '_');
        },

        //converte "912,60", "2.110,37" ou "R$ 1.500" em numero (null quando nao e numerico)
        interpretarValorNumerico(valor) {
            const limpo = String(valor ?? '')
                .replace(/\u00a0/g, ' ')
                .replace(/R\$\s?/gi, '')
                .replace(/%/g, '')
                .replace(/^\+/, '')
                .replace(/\s+/g, '');

            if (!limpo) {
                return null;
            }

            let normalizado = limpo;

            if (limpo.includes(',')) {
                //formato brasileiro: ponto separa milhar e virgula separa os centavos
                normalizado = limpo.replace(/\./g, '').replace(',', '.');
            } else if (/^-?\d{1,3}(\.\d{3})+$/.test(limpo)) {
                //sem virgula e com grupos de tres digitos: o ponto e separador de milhar
                normalizado = limpo.replace(/\./g, '');
            }

            if (!/^-?\d+(\.\d+)?$/.test(normalizado)) {
                return null;
            }

            const numero = Number(normalizado);

            return Number.isFinite(numero) ? numero : null;
        },

        //devolve o valor no mesmo padrao usado no banco: 1.234,56
        formatarValorNumerico(numero) {
            return numero.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        },

        formatarPercentual(percentual) {
            return percentual.toLocaleString('pt-BR', {
                maximumFractionDigits: 2
            });
        },

        arredondarValor(valor) {
            return Number(valor.toFixed(2));
        },

        placeholderAgrupado(linha, coluna) {
            return `{{${linha}.${coluna}}}`;
        },

        placeholderSimples(nome) {
            return `{{${nome}}}`;
        },

        criarId(prefixo) {
            const id = `${prefixo}-${this.proximoId}`;
            this.proximoId += 1;

            return id;
        },

        nomeReservado(nome) {
            return nome === this.nomeVariavelOrdem;
        },

        lerOrdemSalva(variaveis) {
            const variavelOrdem = variaveis.find(variavel => (
                variavel.nome === this.nomeVariavelOrdem
            ));

            if (!variavelOrdem) {
                return {
                    linhas: [],
                    colunas: [],
                    simples: []
                };
            }

            try {
                const ordem = JSON.parse(variavelOrdem.valor);

                return {
                    linhas: Array.isArray(ordem.linhas) ? ordem.linhas : [],
                    colunas: Array.isArray(ordem.colunas) ? ordem.colunas : [],
                    simples: Array.isArray(ordem.simples) ? ordem.simples : []
                };
            } catch (error) {
                return {
                    linhas: [],
                    colunas: [],
                    simples: []
                };
            }
        },

        ordenarPorOrdem(itens, ordem, obterNome) {
            const posicoes = new Map(ordem.map((nome, index) => [nome, index]));

            return [...itens].sort((a, b) => {
                const nomeA = obterNome(a);
                const nomeB = obterNome(b);
                const posicaoA = posicoes.has(nomeA) ? posicoes.get(nomeA) : Number.MAX_SAFE_INTEGER;
                const posicaoB = posicoes.has(nomeB) ? posicoes.get(nomeB) : Number.MAX_SAFE_INTEGER;

                if (posicaoA !== posicaoB) {
                    return posicaoA - posicaoB;
                }

                return nomeA.localeCompare(nomeB);
            });
        },

        serializarEstadoEditavel() {
            return JSON.stringify(this.montarPayload());
        },

        registrarEstadoSalvo() {
            this.estadoSalvo = this.serializarEstadoEditavel();
            this.alteracoesPendentes = false;
        },

        verificarAlteracoesPendentes() {
            if (this.carregando || !this.estadoSalvo) {
                return;
            }

            this.alteracoesPendentes = this.serializarEstadoEditavel() !== this.estadoSalvo;
        },

        montarTabela(variaveis) {
            const ordemSalva = this.lerOrdemSalva(variaveis);
            const linhasMap = new Map(ordemSalva.linhas.map(nome => [
                nome,
                {
                    _id: this.criarId('linha'),
                    nome,
                    valores: {}
                }
            ]));
            const colunasSet = new Set(ordemSalva.colunas);
            const simples = [];

            variaveis.forEach(variavel => {
                const nome = String(variavel.nome || '').trim();
                const valor = String(variavel.valor ?? '');
                const partes = nome.split('.');

                if (this.nomeReservado(nome)) {
                    return;
                }

                if (partes.length === 2 && partes[0] && partes[1]) {
                    const linhaNome = partes[0];
                    const colunaNome = partes[1];

                    colunasSet.add(colunaNome);

                    if (!linhasMap.has(linhaNome)) {
                        linhasMap.set(linhaNome, {
                            _id: this.criarId('linha'),
                            nome: linhaNome,
                            valores: {}
                        });
                    }

                    linhasMap.get(linhaNome).valores[colunaNome] = valor;
                    return;
                }

                if (nome) {
                    simples.push({
                        _id: this.criarId('simples'),
                        nome,
                        valor
                    });
                }
            });

            this.colunas = this.ordenarPorOrdem(
                Array.from(colunasSet),
                ordemSalva.colunas,
                coluna => coluna
            );
            this.linhas = this.ordenarPorOrdem(
                Array.from(linhasMap.values()),
                ordemSalva.linhas,
                linha => linha.nome
            )
                .map(linha => {
                    this.colunas.forEach(coluna => {
                        if (linha.valores[coluna] === undefined) {
                            linha.valores[coluna] = '';
                        }
                    });

                    return linha;
                });
            this.simples = this.ordenarPorOrdem(
                simples,
                ordemSalva.simples,
                variavel => variavel.nome
            );
            this.linhaAdicionadaId = null;
            this.ultimoReajuste = null;
            this.mensagemReajuste = '';
            this.dadosImportacao = null;
            this.erroImportacao = '';
            this.mensagemImportacao = '';
            this.mensagemExportacao = '';
            this.ultimaImportacao = null;
        },

        async carregarVariaveis() {
            try {
                const response = await fetch('/api/variavel');

                if (!response.ok) {
                    throw new Error('Erro ao carregar variaveis.');
                }

                this.variaveis = await response.json();
                this.montarTabela(this.variaveis);
                this.$nextTick(() => {
                    this.registrarEstadoSalvo();
                });

            } catch (error) {
                console.error(error);
                alert(error.message);

            } finally {
                this.carregando = false;
            }
        },

        adicionarLinha() {
            const nome = this.normalizarIdentificador(this.novaLinha);

            if (!nome) {
                alert('Informe um nome valido para a linha.');
                return;
            }

            if (this.linhas.some(linha => linha.nome === nome)) {
                alert('Ja existe uma linha com esse nome.');
                return;
            }

            if (this.nomeReservado(nome)) {
                alert('Esse nome e reservado pelo sistema.');
                return;
            }

            const valores = {};

            this.colunas.forEach(coluna => {
                valores[coluna] = '';
            });

            const novaLinha = {
                _id: this.criarId('linha'),
                nome,
                valores
            };

            this.linhas.push(novaLinha);
            this.linhaAdicionadaId = novaLinha._id;
            this.novaLinha = '';
        },

        adicionarColuna() {
            const nome = this.normalizarIdentificador(this.novaColuna);

            if (!nome) {
                alert('Informe um nome valido para a coluna.');
                return;
            }

            if (this.colunas.includes(nome)) {
                alert('Ja existe uma coluna com esse nome.');
                return;
            }

            if (this.nomeReservado(nome)) {
                alert('Esse nome e reservado pelo sistema.');
                return;
            }

            this.colunas.push(nome);

            this.linhas.forEach(linha => {
                linha.valores[nome] = '';
            });

            this.novaColuna = '';
        },

        removerLinha(linhaRemovida) {
            if (!confirm(`Remover a linha ${linhaRemovida.nome}?`)) {
                return;
            }

            this.linhas = this.linhas.filter(linha => linha !== linhaRemovida);
        },

        removerColuna(colunaRemovida) {
            if (!confirm(`Remover a coluna ${colunaRemovida}?`)) {
                return;
            }

            this.colunas = this.colunas.filter(coluna => coluna !== colunaRemovida);

            this.linhas.forEach(linha => {
                delete linha.valores[colunaRemovida];
            });
        },

        normalizarLinha(linha) {
            const nome = this.normalizarIdentificador(linha.nome);

            if (!nome) {
                alert('O nome da linha nao pode ficar vazio.');
                linha.nome = 'linha';
                return;
            }

            if (this.nomeReservado(nome)) {
                alert('Esse nome e reservado pelo sistema.');
                return;
            }

            const duplicada = this.linhas.some(item => item !== linha && item.nome === nome);

            if (duplicada) {
                alert('Ja existe uma linha com esse nome.');
                return;
            }

            linha.nome = nome;
        },

        iniciarEdicaoColuna(coluna) {
            this.colunaEmEdicao = coluna;
        },

        normalizarColuna(indice) {
            const original = this.colunaEmEdicao || this.colunas[indice];
            const nome = this.normalizarIdentificador(this.colunas[indice]);

            if (!nome) {
                alert('O nome da coluna nao pode ficar vazio.');
                this.colunas[indice] = original;
                return;
            }

            if (this.nomeReservado(nome)) {
                alert('Esse nome e reservado pelo sistema.');
                this.colunas[indice] = original;
                return;
            }

            const duplicada = this.colunas.some((coluna, colunaIndice) => (
                colunaIndice !== indice && coluna === nome
            ));

            if (duplicada) {
                alert('Ja existe uma coluna com esse nome.');
                this.colunas[indice] = original;
                return;
            }

            if (original !== nome) {
                this.linhas.forEach(linha => {
                    linha.valores[nome] = linha.valores[original] ?? '';
                    delete linha.valores[original];
                });
            }

            this.colunas[indice] = nome;
            this.colunaEmEdicao = '';
        },

        adicionarSimples() {
            const nome = this.normalizarIdentificador(this.novoSimples.nome);
            const valor = String(this.novoSimples.valor ?? '').trim();

            if (!nome || !valor) {
                alert('Informe nome e valor para a variavel simples.');
                return;
            }

            if (this.simples.some(variavel => variavel.nome === nome)) {
                alert('Ja existe uma variavel simples com esse nome.');
                return;
            }

            if (this.nomeReservado(nome)) {
                alert('Esse nome e reservado pelo sistema.');
                return;
            }

            if (nome.includes('.')) {
                alert('Variaveis simples nao usam ponto no nome.');
                return;
            }

            this.simples.push({
                _id: this.criarId('simples'),
                nome,
                valor
            });
            this.novoSimples = {
                nome: '',
                valor: ''
            };
        },

        removerSimples(variavelRemovida) {
            this.simples = this.simples.filter(variavel => variavel !== variavelRemovida);
        },

        normalizarSimples(variavel) {
            const nome = this.normalizarIdentificador(variavel.nome);

            if (!nome) {
                alert('O nome da variavel nao pode ficar vazio.');
                variavel.nome = 'variavel';
                return;
            }

            if (this.nomeReservado(nome)) {
                alert('Esse nome e reservado pelo sistema.');
                return;
            }

            const duplicada = this.simples.some(item => item !== variavel && item.nome === nome);

            if (duplicada) {
                alert('Ja existe uma variavel simples com esse nome.');
                return;
            }

            variavel.nome = nome;
        },

        moverItem(lista, origem, destino) {
            if (!Number.isInteger(origem) || origem === -1 || destino === -1 || origem === destino) {
                return;
            }

            const [item] = lista.splice(origem, 1);
            lista.splice(destino, 0, item);
        },

        iniciarArrastoLinha(linha, event) {
            this.arrastoLinhaId = linha._id;

            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', linha._id);
            }
        },

        finalizarArrastoLinha() {
            this.arrastoLinhaId = null;
        },

        soltarLinha(linhaDestino) {
            const origem = this.linhas.findIndex(linha => linha._id === this.arrastoLinhaId);
            const destino = this.linhas.findIndex(linha => linha._id === linhaDestino._id);

            this.moverItem(this.linhas, origem, destino);
            this.finalizarArrastoLinha();
        },

        iniciarArrastoColuna(indice, event) {
            this.arrastoColunaIndex = indice;

            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', String(indice));
            }
        },

        finalizarArrastoColuna() {
            this.arrastoColunaIndex = null;
        },

        soltarColuna(indiceDestino) {
            this.moverItem(this.colunas, this.arrastoColunaIndex, indiceDestino);
            this.finalizarArrastoColuna();
        },

        aplicarReajuste() {
            if (this.linhas.length === 0 || this.colunas.length === 0) {
                alert('Adicione linhas e colunas antes de aplicar o reajuste.');
                return;
            }

            const percentual = this.interpretarValorNumerico(this.reajustePercentual);

            if (percentual === null) {
                alert('Informe um percentual válido. Exemplo: 4,5');
                return;
            }

            if (percentual === 0) {
                alert('O percentual precisa ser diferente de zero.');
                return;
            }

            if (percentual <= -100) {
                alert('O percentual deve ser maior que -100%.');
                return;
            }

            const fator = 1 + percentual / 100;
            const valoresAnteriores = this.linhas.map(linha => ({
                id: linha._id,
                valores: { ...linha.valores }
            }));
            let atualizados = 0;
            let ignorados = 0;

            //percorre todas as linhas (inclusive as que estao fora do filtro da busca)
            this.linhas.forEach(linha => {
                this.colunas.forEach(coluna => {
                    const valorAtual = String(linha.valores[coluna] ?? '').trim();

                    if (!valorAtual) {
                        return;
                    }

                    const numero = this.interpretarValorNumerico(valorAtual);

                    if (numero === null) {
                        ignorados += 1;
                        return;
                    }

                    linha.valores[coluna] = this.formatarValorNumerico(
                        this.arredondarValor(numero * fator)
                    );
                    atualizados += 1;
                });
            });

            if (atualizados === 0) {
                alert('Nenhum valor numérico encontrado na tabela para aplicar o reajuste.');
                return;
            }

            this.ultimoReajuste = {
                percentual,
                valoresAnteriores
            };

            const sinal = percentual > 0 ? '+' : '';

            this.mensagemReajuste = [
                `Reajuste de ${sinal}${this.formatarPercentual(percentual)}% aplicado em ${atualizados} ${atualizados === 1 ? 'valor' : 'valores'}.`,
                ignorados > 0
                    ? `${ignorados} ${ignorados === 1 ? 'valor foi ignorado' : 'valores foram ignorados'} por não ser numérico.`
                    : '',
                'Salve as variáveis para confirmar.'
            ].filter(Boolean).join(' ');

            this.reajustePercentual = '';
        },

        desfazerReajuste() {
            if (!this.ultimoReajuste) {
                return;
            }

            const anteriores = new Map(
                this.ultimoReajuste.valoresAnteriores.map(item => [item.id, item.valores])
            );

            this.linhas.forEach(linha => {
                const valores = anteriores.get(linha._id);

                if (!valores) {
                    return;
                }

                this.colunas.forEach(coluna => {
                    linha.valores[coluna] = valores[coluna] ?? '';
                });
            });

            this.ultimoReajuste = null;
            this.mensagemReajuste = 'Reajuste desfeito: os valores anteriores foram restaurados.';
        },

        //dois valores sao equivalentes quando sao iguais como texto ou como numero (1.234,56 = 1234.56)
        valoresEquivalentes(valorAtual, novoValor) {
            if (valorAtual === novoValor) {
                return true;
            }

            const numeroAtual = this.interpretarValorNumerico(valorAtual);
            const numeroNovo = this.interpretarValorNumerico(novoValor);

            return numeroAtual !== null
                && numeroNovo !== null
                && Math.abs(numeroAtual - numeroNovo) < 0.005;
        },

        valorDaCelulaImportada(celula) {
            if (!celula || celula.tipo === 'vazio') {
                return '';
            }

            if (celula.tipo === 'numero') {
                return this.formatarValorNumerico(this.arredondarValor(Number(celula.valor)));
            }

            return String(celula.valor ?? '').trim();
        },

        //guarda o estado completo da tabela (colunas, linhas e valores) para permitir desfazer
        capturarEstadoTabela() {
            return {
                colunas: [...this.colunas],
                linhas: this.linhas.map(linha => ({
                    id: linha._id,
                    nome: linha.nome,
                    valores: { ...linha.valores }
                }))
            };
        },

        restaurarEstadoTabela(estado) {
            const atuais = new Map(this.linhas.map(linha => [linha._id, linha]));

            this.linhas = estado.linhas.map(item => {
                const linha = atuais.get(item.id) || {
                    _id: item.id,
                    nome: item.nome,
                    valores: {}
                };

                linha.nome = item.nome;
                linha.valores = { ...item.valores };

                return linha;
            });
            this.colunas = [...estado.colunas];
        },

        baixarArquivo(blob, nomeArquivo) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');

            link.href = url;
            link.download = nomeArquivo;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        },

        async exportarPlanilha() {
            if (this.linhas.length === 0 || this.colunas.length === 0) {
                alert('Adicione linhas e colunas antes de exportar a planilha.');
                return;
            }

            this.exportando = true;

            try {
                const response = await fetch('/api/variavel/tabela/exportar', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        colunas: this.colunas,
                        linhas: this.linhas.map(linha => ({
                            nome: linha.nome,
                            valores: linha.valores
                        }))
                    })
                });

                if (!response.ok) {
                    let mensagem = 'Erro ao exportar a planilha.';

                    try {
                        const dados = await response.json();
                        mensagem = dados.erro || mensagem;
                    } catch (error) {
                        console.error(error);
                    }

                    throw new Error(mensagem);
                }

                const blob = await response.blob();
                const disposicao = response.headers.get('Content-Disposition') || '';
                const encontrado = disposicao.match(/filename="?([^";]+)"?/i);
                const nomeArquivo = encontrado ? encontrado[1] : 'variaveis-agrupadas.xlsx';

                this.baixarArquivo(blob, nomeArquivo);
                this.mensagemExportacao = `Planilha exportada com ${this.linhas.length} linhas e ${this.colunas.length} colunas.`;

            } catch (error) {
                console.error(error);
                alert(error.message);

            } finally {
                this.exportando = false;
            }
        },

        selecionarArquivoImportacao(event) {
            const entrada = event.target;
            const arquivo = entrada.files && entrada.files[0];

            //limpa o input para permitir escolher o mesmo arquivo novamente
            entrada.value = '';

            if (!arquivo) {
                return;
            }

            if (!/\.xlsx$/i.test(arquivo.name)) {
                this.erroImportacao = 'Selecione um arquivo .xlsx (a planilha exportada por esta tela).';
                return;
            }

            this.enviarArquivoImportacao(arquivo);
        },

        async enviarArquivoImportacao(arquivo) {
            this.importando = true;
            this.erroImportacao = '';
            this.mensagemImportacao = '';
            this.dadosImportacao = null;

            try {
                const conteudo = await arquivo.arrayBuffer();
                const response = await fetch('/api/variavel/tabela/importar', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/octet-stream'
                    },
                    body: conteudo
                });

                let dados = null;

                try {
                    dados = await response.json();
                } catch (error) {
                    console.error(error);
                }

                if (!response.ok) {
                    throw new Error(dados?.erro || 'Não foi possível ler a planilha enviada.');
                }

                if (!dados || !Array.isArray(dados.linhas) || !Array.isArray(dados.colunas)) {
                    throw new Error('A resposta da importação veio incompleta. Tente novamente.');
                }

                this.dadosImportacao = {
                    arquivo: arquivo.name,
                    aba: dados.aba,
                    colunas: dados.colunas,
                    linhas: dados.linhas,
                    avisos: dados.avisos || []
                };

            } catch (error) {
                console.error(error);
                this.erroImportacao = error.message;

            } finally {
                this.importando = false;
            }
        },

        cancelarImportacao() {
            this.dadosImportacao = null;
            this.erroImportacao = '';
        },

        //aplica a planilha apenas na tela: nada vai para o banco ate clicar em "Salvar variaveis"
        aplicarImportacao() {
            const resumo = this.resumoImportacao;
            const dados = this.dadosImportacao;

            if (!dados || !resumo) {
                return;
            }

            if (!resumo.podeAplicar) {
                alert('A planilha não tem nenhuma alteração em relação à tabela atual.');
                return;
            }

            const estadoAnterior = this.capturarEstadoTabela();
            let colunasCriadas = 0;
            let linhasCriadas = 0;
            let celulasAtualizadas = 0;

            //1) colunas novas (somente se o usuario permitir)
            if (this.importarNovasColunas) {
                resumo.novasColunas.forEach(coluna => {
                    if (this.colunas.includes(coluna)) {
                        return;
                    }

                    this.colunas.push(coluna);

                    this.linhas.forEach(linha => {
                        if (linha.valores[coluna] === undefined) {
                            linha.valores[coluna] = '';
                        }
                    });

                    colunasCriadas += 1;
                });
            }

            //2) linhas novas (somente se o usuario permitir)
            if (this.importarNovasLinhas) {
                resumo.novasLinhas.forEach(linhaArquivo => {
                    const jaExiste = this.linhas.some(linha => (
                        this.normalizarIdentificador(linha.nome) === linhaArquivo.nome
                    ));

                    if (jaExiste) {
                        return;
                    }

                    const valores = {};

                    this.colunas.forEach(coluna => {
                        valores[coluna] = '';
                    });

                    Object.keys(linhaArquivo.valores).forEach(colunaArquivo => {
                        const colunaAtual = this.colunas.find(coluna => (
                            this.normalizarIdentificador(coluna) === colunaArquivo
                        ));

                        if (colunaAtual) {
                            valores[colunaAtual] = this.valorDaCelulaImportada(linhaArquivo.valores[colunaArquivo]);
                        }
                    });

                    this.linhas.push({
                        _id: this.criarId('linha'),
                        nome: linhaArquivo.nome,
                        valores
                    });

                    linhasCriadas += 1;
                });
            }

            //3) celulas das linhas que ja existem (apenas colunas presentes no arquivo)
            const colunasNoArquivo = dados.colunas
                .map(nome => ({
                    arquivo: nome,
                    atual: this.colunas.find(coluna => this.normalizarIdentificador(coluna) === nome)
                }))
                .filter(coluna => coluna.atual);

            dados.linhas.forEach(linhaArquivo => {
                const linhaAtual = this.linhas.find(linha => (
                    this.normalizarIdentificador(linha.nome) === linhaArquivo.nome
                ));

                if (!linhaAtual) {
                    return;
                }

                colunasNoArquivo.forEach(({ arquivo: colunaArquivo, atual: colunaAtual }) => {
                    const celula = linhaArquivo.valores[colunaArquivo];
                    const valorAtual = String(linhaAtual.valores[colunaAtual] ?? '').trim();

                    if (!celula) {
                        if (this.limparCelulasVazias && valorAtual) {
                            linhaAtual.valores[colunaAtual] = '';
                            celulasAtualizadas += 1;
                        }

                        return;
                    }

                    const novoValor = this.valorDaCelulaImportada(celula);

                    if (this.valoresEquivalentes(valorAtual, novoValor)) {
                        return;
                    }

                    linhaAtual.valores[colunaAtual] = novoValor;
                    celulasAtualizadas += 1;
                });
            });

            const partes = [];

            if (celulasAtualizadas > 0) {
                partes.push(`${celulasAtualizadas} ${celulasAtualizadas === 1 ? 'célula atualizada' : 'células atualizadas'}`);
            }

            if (linhasCriadas > 0) {
                partes.push(`${linhasCriadas} ${linhasCriadas === 1 ? 'linha adicionada' : 'linhas adicionadas'}`);
            }

            if (colunasCriadas > 0) {
                partes.push(`${colunasCriadas} ${colunasCriadas === 1 ? 'coluna adicionada' : 'colunas adicionadas'}`);
            }

            this.ultimaImportacao = estadoAnterior;
            this.dadosImportacao = null;
            this.erroImportacao = '';
            this.mensagemImportacao = `Importação aplicada: ${partes.join(', ')}. Salve as variáveis para confirmar.`;
        },

        desfazerImportacao() {
            if (!this.ultimaImportacao) {
                return;
            }

            this.restaurarEstadoTabela(this.ultimaImportacao);
            this.ultimaImportacao = null;
            this.mensagemImportacao = 'Importação desfeita: a tabela voltou ao estado anterior à importação.';
        },

        montarPayload() {
            const variaveis = [{
                nome: this.nomeVariavelOrdem,
                valor: JSON.stringify({
                    linhas: this.linhas.map(linha => this.normalizarIdentificador(linha.nome)).filter(Boolean),
                    colunas: this.colunas.map(coluna => this.normalizarIdentificador(coluna)).filter(Boolean),
                    simples: this.simples.map(variavel => this.normalizarIdentificador(variavel.nome)).filter(Boolean)
                })
            }];

            this.simples.forEach(variavel => {
                const nome = this.normalizarIdentificador(variavel.nome);
                const valor = String(variavel.valor ?? '').trim();

                if (nome && valor) {
                    variaveis.push({ nome, valor });
                }
            });

            this.linhas.forEach(linha => {
                const linhaNome = this.normalizarIdentificador(linha.nome);

                this.colunas.forEach(coluna => {
                    const colunaNome = this.normalizarIdentificador(coluna);
                    const valor = String(linha.valores[coluna] ?? '').trim();

                    if (linhaNome && colunaNome && valor) {
                        variaveis.push({
                            nome: `${linhaNome}.${colunaNome}`,
                            valor
                        });
                    }
                });
            });

            return variaveis;
        },

        async salvarTabela() {
            this.salvando = true;

            try {
                const response = await fetch('/api/variavel/tabela', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        variaveis: this.montarPayload()
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.erro || 'Erro ao salvar variaveis.');
                }

                this.variaveis = data;
                this.montarTabela(data);
                this.$nextTick(() => {
                    this.registrarEstadoSalvo();
                });
                alert('Variaveis salvas com sucesso.');

            } catch (error) {
                console.error(error);
                alert(error.message);

            } finally {
                this.salvando = false;
            }
        },

        async copiarTexto(texto) {
            const conteudo = String(texto ?? '');

            if (!conteudo) {
                return;
            }

            if (await this.tentarClipboardModerno(conteudo)) {
                this.mostrarAvisoCopia(`Copiado: ${conteudo}`);
                return;
            }

            try {
                this.copiarComComandoDoNavegador(conteudo);
                this.mostrarAvisoCopia(`Copiado: ${conteudo}`);

            } catch (error) {
                console.error('Erro ao copiar:', error);
                this.mostrarAvisoCopia('Não foi possível copiar automaticamente.', true);
                this.pedirCopiaManual(conteudo);
            }
        },

        //a API navigator.clipboard so existe em contexto seguro (HTTPS ou localhost);
        //em HTTP ela e undefined e o acesso direto quebraria a copia
        async tentarClipboardModerno(texto) {
            const areaTransferencia = navigator.clipboard;

            if (!window.isSecureContext || !areaTransferencia || typeof areaTransferencia.writeText !== 'function') {
                return false;
            }

            try {
                await areaTransferencia.writeText(texto);
                return true;

            } catch (error) {
                console.warn('Área de transferência do navegador indisponível, usando método alternativo:', error);
                return false;
            }
        },

        //fallback para HTTP: seleciona um campo temporario fora da tela e usa o comando de copia do navegador
        copiarComComandoDoNavegador(texto) {
            const campo = document.createElement('textarea');

            campo.value = texto;
            campo.setAttribute('readonly', '');
            campo.setAttribute('aria-hidden', 'true');
            campo.style.fontSize = '16px';
            campo.style.left = '-9999px';
            campo.style.opacity = '0';
            campo.style.position = 'fixed';
            campo.style.top = '0';

            document.body.appendChild(campo);

            try {
                campo.focus();
                campo.select();

                try {
                    campo.setSelectionRange(0, texto.length);
                } catch (error) {
                    //alguns navegadores moveis nao aceitam setSelectionRange em campo readonly
                }

                const copiado = typeof document.execCommand === 'function' && document.execCommand('copy');

                if (!copiado) {
                    throw new Error('O navegador bloqueou a cópia automática.');
                }

            } finally {
                document.body.removeChild(campo);
            }
        },

        mostrarAvisoCopia(mensagem, erro = false) {
            this.avisoCopia = {
                mensagem,
                erro
            };

            if (this.temporizadorCopia) {
                clearTimeout(this.temporizadorCopia);
            }

            this.temporizadorCopia = setTimeout(() => {
                this.avisoCopia = {
                    mensagem: '',
                    erro: false
                };
                this.temporizadorCopia = null;
            }, 2400);
        },

        //ultimo recurso (navegador muito antigo): mostra o texto para copiar com Ctrl+C
        pedirCopiaManual(texto) {
            try {
                window.prompt('Copie o texto abaixo com Ctrl+C:', texto);
            } catch (error) {
                console.error('Não foi possível abrir a cópia manual:', error);
            }
        }
    },

    mounted() {
        this.carregarVariaveis();
    }
}).mount('#app');
