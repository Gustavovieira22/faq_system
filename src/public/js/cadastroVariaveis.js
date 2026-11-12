const { createApp } = Vue;

createApp({
    data() {
        return {
            variaveis: [],
            form: {
                nome: '',
                valor: ''
            },
            editForm: {
                id: null,
                nome: '',
                valor: ''
            },
            carregando: true,
            salvando: false
        };
    },

    methods: {
        async carregarVariaveis() {
            try {
                const response = await fetch('/api/variavel');

                if (!response.ok) {
                    throw new Error('Erro ao carregar variáveis.');
                }

                this.variaveis = await response.json();

            } catch (error) {
                console.error(error);
                alert(error.message);

            } finally {
                this.carregando = false;
            }
        },

        async cadastrarVariavel() {
            this.salvando = true;

            try {
                const response = await fetch('/api/variavel', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(this.form)
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.erro || 'Erro ao cadastrar variável.');
                }

                this.variaveis.push(data);

                this.form = {
                    nome: '',
                    valor: ''
                };

            } catch (error) {
                console.error(error);
                alert(error.message);

            } finally {
                this.salvando = false;
            }
        },

        abrirModalEdicao(variavel) {
            this.editForm = {
                id: variavel.id,
                nome: variavel.nome,
                valor: variavel.valor
            };
        },

        async salvarEdicaoVariavel() {
            this.salvando = true;

            try {
                const response = await fetch(`/api/variavel/${this.editForm.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        valor: this.editForm.valor
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.erro || 'Erro ao atualizar variável.');
                }

                const index = this.variaveis.findIndex(
                    variavel => variavel.id === this.editForm.id
                );

                if (index !== -1) {
                    this.variaveis[index].valor = this.editForm.valor;
                }

                const modalElement = document.getElementById('modalEditarVariavel');
                const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
                modal.hide();

                this.editForm = {
                    id: null,
                    nome: '',
                    valor: ''
                };

            } catch (error) {
                console.error(error);
                alert(error.message);

            } finally {
                this.salvando = false;
            }
        }
    },

    mounted() {
        this.carregarVariaveis();
    }
}).mount('#app');