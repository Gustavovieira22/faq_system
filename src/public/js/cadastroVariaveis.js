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
            colunaEmEdicao: '',
            filtro: '',
            carregando: true,
            salvando: false,
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

        montarTabela(variaveis) {
            const linhasMap = new Map();
            const colunasSet = new Set();
            const simples = [];

            variaveis.forEach(variavel => {
                const nome = String(variavel.nome || '').trim();
                const valor = String(variavel.valor ?? '');
                const partes = nome.split('.');

                if (partes.length === 2 && partes[0] && partes[1]) {
                    const linhaNome = partes[0];
                    const colunaNome = partes[1];

                    colunasSet.add(colunaNome);

                    if (!linhasMap.has(linhaNome)) {
                        linhasMap.set(linhaNome, {
                            nome: linhaNome,
                            valores: {}
                        });
                    }

                    linhasMap.get(linhaNome).valores[colunaNome] = valor;
                    return;
                }

                if (nome) {
                    simples.push({ nome, valor });
                }
            });

            this.colunas = Array.from(colunasSet).sort();
            this.linhas = Array.from(linhasMap.values())
                .sort((a, b) => a.nome.localeCompare(b.nome))
                .map(linha => {
                    this.colunas.forEach(coluna => {
                        if (linha.valores[coluna] === undefined) {
                            linha.valores[coluna] = '';
                        }
                    });

                    return linha;
                });
            this.simples = simples.sort((a, b) => a.nome.localeCompare(b.nome));
        },

        async carregarVariaveis() {
            try {
                const response = await fetch('/api/variavel');

                if (!response.ok) {
                    throw new Error('Erro ao carregar variaveis.');
                }

                this.variaveis = await response.json();
                this.montarTabela(this.variaveis);

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

            const valores = {};

            this.colunas.forEach(coluna => {
                valores[coluna] = '';
            });

            this.linhas.push({ nome, valores });
            this.linhas.sort((a, b) => a.nome.localeCompare(b.nome));
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

            this.colunas.push(nome);
            this.colunas.sort();

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
                    linha.valores[nome] = linha.valores[original] || '';
                    delete linha.valores[original];
                });
            }

            this.colunas[indice] = nome;
            this.colunas.sort();
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

            if (nome.includes('.')) {
                alert('Variaveis simples nao usam ponto no nome.');
                return;
            }

            this.simples.push({ nome, valor });
            this.simples.sort((a, b) => a.nome.localeCompare(b.nome));
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

            const duplicada = this.simples.some(item => item !== variavel && item.nome === nome);

            if (duplicada) {
                alert('Ja existe uma variavel simples com esse nome.');
                return;
            }

            variavel.nome = nome;
        },

        montarPayload() {
            const variaveis = [];

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
