const { createApp } = Vue;

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
            exemplo_placeholder: '{{curso_ads.preco_cheio}}'
        };
    },

    computed: {
        linhasFiltradas() {
            const termo = this.filtro.trim().toLowerCase();

            if (!termo) {
                return this.linhas;
            }

            return this.linhas.filter(linha => {
                if (linha.nome.toLowerCase().includes(termo)) {
                    return true;
                }

                return this.colunas.some(coluna => {
                    const valor = linha.valores[coluna] || '';

                    return coluna.toLowerCase().includes(termo)
                        || valor.toLowerCase().includes(termo);
                });
            });
        },

        simplesFiltradas() {
            const termo = this.filtroSimples.trim().toLowerCase();

            if (!termo) {
                return this.simples;
            }

            return this.simples.filter(variavel => (
                variavel.nome.toLowerCase().includes(termo)
                || String(variavel.valor || '').toLowerCase().includes(termo)
                || this.placeholderSimples(variavel.nome).toLowerCase().includes(termo)
            ));
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
        normalizarIdentificador(valor) {
            return String(valor || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim()
                .replace(/[^A-Za-z0-9_]+/g, '_')
                .replace(/^_+|_+$/g, '')
                .replace(/_+/g, '_');
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

            this.linhas.push({
                _id: this.criarId('linha'),
                nome,
                valores
            });
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
            try {
                await navigator.clipboard.writeText(texto);
            } catch (error) {
                console.error('Erro ao copiar:', error);
            }
        }
    },

    mounted() {
        this.carregarVariaveis();
    }
}).mount('#app');
