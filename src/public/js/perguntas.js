const { createApp } = Vue;

//quantidade maxima de itens exibidos sem busca ativa (os demais aparecem pela busca)
const LIMITE_EXIBICAO = 10;

createApp({
    data() {
        return {
            editorResposta: null,
            editorEdicaoResposta: null,
            perguntas: [],
            busca: '',
            carregando: true,
            isAdmin: Boolean(window.USUARIO_ADMIN),
            salvandoEdicao: false,
            excluindoId: null,
            copiadoId: null,
            temporizadorCopiado: null,
            form: {
                titulo: '',
                resposta: '',
            },
            editForm: {
                id: null,
                titulo: '',
                resposta: '',
            }
        };
    },

    computed: {
        buscaAtiva() {
            return Boolean(this.normalizarTexto(this.busca));
        },

        perguntasFiltradas() {
            const termo = this.normalizarTexto(this.busca);

            //sem busca: limita a quantidade de perguntas exibidas na tela (lista ja vem no ranking)
            if (!termo) {
                return this.perguntas.slice(0, LIMITE_EXIBICAO);
            }

            //com busca: procura no titulo e no corpo da resposta (ignora acentos e maiusculas)
            //varios termos funcionam como filtros combinados: todos precisam aparecer
            const termos = termo.split(/\s+/).filter(Boolean);

            return this.perguntas.filter(pergunta => (
                termos.every(item => this.textoBuscaPergunta(pergunta).includes(item))
            ));
        },

        resumoPerguntas() {
            const total = this.perguntas.length;
            const exibidas = this.perguntasFiltradas.length;

            if (total === 0) {
                return '0 perguntas';
            }

            if (exibidas === total) {
                return total === 1 ? '1 pergunta' : `${total} perguntas`;
            }

            return `${exibidas} de ${total} perguntas`;
        },

        textoBusca() {
            if (this.buscaAtiva) {
                const encontradas = this.perguntasFiltradas.length;

                return encontradas === 1
                    ? '1 pergunta encontrada.'
                    : `${encontradas} perguntas encontradas.`;
            }

            if (this.perguntas.length > LIMITE_EXIBICAO) {
                return `Mostrando as ${LIMITE_EXIBICAO} perguntas mais copiadas de ${this.perguntas.length}. Use a busca para ver as demais.`;
            }

            return 'Lista ordenada pelas respostas mais copiadas. Busque pelo título ou pelo conteúdo da resposta.';
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

        //converte o HTML da resposta em texto simples para a busca
        //(troca quebras e blocos por espaco para nao grudar palavras e decodifica entidades)
        textoPuroHtml(html) {
            const semTags = String(html || '')
                .replace(/<br\s*\/?>/gi, ' ')
                .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|td|th|blockquote)>/gi, ' ')
                .replace(/<[^>]+>/g, ' ');

            const decodificador = document.createElement('textarea');
            decodificador.innerHTML = semTags;

            return decodificador.value;
        },

        //texto normalizado usado na busca: titulo + corpo da resposta
        montarTextoBusca(pergunta) {
            return this.normalizarTexto(
                `${pergunta.titulo || ''} ${this.textoPuroHtml(pergunta.resposta)}`
            );
        },

        //indice montado uma vez ao carregar a lista, evitando reprocessar o HTML a cada tecla
        montarIndiceBusca(perguntas) {
            return perguntas.map(pergunta => ({
                ...pergunta,
                textoBusca: this.montarTextoBusca(pergunta)
            }));
        },

        //usa o indice pronto; se a pergunta ainda nao tiver indice, calcula na hora
        textoBuscaPergunta(pergunta) {
            return typeof pergunta.textoBusca === 'string'
                ? pergunta.textoBusca
                : this.montarTextoBusca(pergunta);
        },

        async cadastrarPergunta() {
            if (!this.isAdmin) {
                return;
            }

            try {
                this.form.resposta = this.editorResposta.root.innerHTML;
                const response = await fetch('/api/perguntas', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(this.form)
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.erro || 'Erro ao cadastrar pergunta.');
                }
                
                console.log(data);

                this.editorResposta.root.innerHTML = '';
                this.form = {
                    titulo: '',
                    resposta: '',
                };

                const modalElement = document.getElementById('modalCadastroPergunta');
                const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
                modal.hide();

                this.carregando = true;
                this.getPerguntas();

            } catch (error) {
                console.error(error);
            }
        },
        abrirModalEdicao(pergunta) {
            if (!this.isAdmin) {
                return;
            }

            this.editForm = {
                id: pergunta.id,
                titulo: pergunta.titulo,
                resposta: pergunta.respostaOriginal || pergunta.resposta,
            };

            this.editorEdicaoResposta.root.innerHTML = this.editForm.resposta;

            const modalElement = document.getElementById('modalEditarPergunta');
            const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
            modal.show();
        },
        async salvarEdicaoPergunta() {
            if (!this.isAdmin) {
                return;
            }

            this.salvandoEdicao = true;

            try {
                this.editForm.resposta = this.editorEdicaoResposta.root.innerHTML;

                const response = await fetch(`/api/perguntas/${this.editForm.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        titulo: this.editForm.titulo,
                        resposta: this.editForm.resposta
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.erro || 'Erro ao atualizar pergunta.');
                }

                const modalElement = document.getElementById('modalEditarPergunta');
                const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
                modal.hide();

                this.editForm = {
                    id: null,
                    titulo: '',
                    resposta: '',
                };

                this.carregando = true;
                await this.getPerguntas();

            } catch (error) {
                console.error(error);
                alert(error.message);

            } finally {
                this.salvandoEdicao = false;
            }
        },
        async excluirPergunta(pergunta) {
            if (!this.isAdmin || this.excluindoId) {
                return;
            }

            if (!confirm(`Excluir a pergunta "${pergunta.titulo}"? Essa ação não pode ser desfeita.`)) {
                return;
            }

            this.excluindoId = pergunta.id;

            try {
                const response = await fetch(`/api/perguntas/${pergunta.id}`, {
                    method: 'DELETE'
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.erro || 'Erro ao excluir pergunta.');
                }

                //remove a pergunta da lista exibida sem recarregar a pagina
                this.perguntas = this.perguntas.filter(item => item.id !== pergunta.id);

            } catch (error) {
                console.error(error);
                alert(error.message);

            } finally {
                this.excluindoId = null;
            }
        },

        async getPerguntas(){
            try {
                const response = await fetch('/api/perguntas');
                const perguntas = await response.json();

                //o servidor ja envia no ranking; a ordenacao aqui mantem a tela consistente
                const lista = Array.isArray(perguntas) ? this.ordenarPorRanking(perguntas) : [];

                //inclui o corpo da resposta no indice de busca
                this.perguntas = this.montarIndiceBusca(lista);

            } catch (error) {
                console.error('Erro ao carregar perguntas:', error);

            }finally {
                this.carregando = false;
            }
        },
        htmlParaTextoWhatsapp(html) {
            const container = document.createElement('div');
            container.innerHTML = html;

            const converterNode = (node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    return node.textContent;
                }

                if (node.nodeType !== Node.ELEMENT_NODE) {
                    return '';
                }

                const tag = node.tagName.toLowerCase();

                if (tag === 'br') {
                    return '\n';
                }

                let conteudo = '';

                for (const child of node.childNodes) {
                    conteudo += converterNode(child);
                }

                if (tag === 'strong' || tag === 'b') {
                    conteudo = `*${conteudo}*`;
                }

                if (tag === 'em' || tag === 'i') {
                    conteudo = `_${conteudo}_`;
                }

                if (tag === 'p' || tag === 'div') {
                    return conteudo + '\n';
                }

                return conteudo;
            };

            let texto = '';

            for (const child of container.childNodes) {
                texto += converterNode(child);
            }

            return texto.trim();
        },

        copiarTextoComFallback(texto) {
            const textarea = document.createElement('textarea');

            textarea.value = texto;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '0';

            document.body.appendChild(textarea);
            textarea.select();
            textarea.setSelectionRange(0, textarea.value.length);

            const copiado = document.execCommand('copy');

            document.body.removeChild(textarea);

            if (!copiado) {
                throw new Error('Comando de copia bloqueado pelo navegador.');
            }
        },

        async copiarResposta(pergunta) {
            try {
                const texto = this.htmlParaTextoWhatsapp(pergunta.resposta);

                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(texto);
                } else {
                    this.copiarTextoComFallback(texto);
                }

                this.destacarCopiado(pergunta.id);
                this.registrarCopia(pergunta);

            } catch (error) {
                console.error('Erro ao copiar resposta:', error);
                alert('Não foi possível copiar a resposta.');
            }
        },

        //feedback curto no botao para confirmar que o texto foi copiado
        destacarCopiado(id) {
            this.copiadoId = id;

            if (this.temporizadorCopiado) {
                clearTimeout(this.temporizadorCopiado);
            }

            this.temporizadorCopiado = setTimeout(() => {
                this.copiadoId = null;
                this.temporizadorCopiado = null;
            }, 2000);
        },

        //mesma regra do servidor: mais copiadas primeiro e, no empate, a mais antiga
        ordenarPorRanking(perguntas) {
            return [...perguntas].sort((a, b) => {
                const diferenca = (Number(b.copias) || 0) - (Number(a.copias) || 0);

                return diferenca !== 0 ? diferenca : a.id - b.id;
            });
        },

        //conta a copia no servidor; a lista NAO e reordenada agora para a pergunta
        //nao pular de lugar enquanto o usuario ainda esta lendo/copiando
        async registrarCopia(pergunta) {
            try {
                const response = await fetch(`/api/perguntas/${pergunta.id}/copiar`, {
                    method: 'POST'
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.erro || 'Erro ao registrar a cópia.');
                }

                //o servidor limita uma copia por usuario por pergunta na janela definida
                if (data.contabilizada) {
                    pergunta.copias = data.copias;
                }

            } catch (error) {
                console.error('Erro ao registrar a cópia da resposta:', error);
            }
        }
    },

    async mounted() {
        this.getPerguntas();

        if (!this.isAdmin) {
            return;
        }

        this.editorResposta = new Quill('#editor-resposta', {
            theme: 'snow',
            placeholder: 'Digite um texto para resposta',
            modules: {
                toolbar: [
                    ['bold', 'italic'],
                    ['clean']
                ]
            }
        });

        this.editorEdicaoResposta = new Quill('#editor-edicao-resposta', {
            theme: 'snow',
            placeholder: 'Digite um texto para resposta',
            modules: {
                toolbar: [
                    ['bold', 'italic'],
                    ['clean']
                ]
            }
        });
    }
}).mount('#app');
