# 💰 Sistema Cabe no bolso

> Sistema de gestão financeira pessoal completo e intuitivo com tema escuro e detalhes em verde neon. Controle orçamentos mensais (com navegação até 2035), salários, gastos categorizados, cartões de crédito e relatórios analíticos de liquidez e poupança.

---

## 🚀 Funcionalidades

- **📊 Dashboard Anual & Mensal**:
  - Resumo de salários, gastos, saldo anual consolidado e faturas de cartão.
  - Gráfico comparativo mês a mês para qualquer ano até **2035**.
  - Alerta dinâmico de meses em que os gastos ultrapassaram a renda.
  - Indicador de exposição e limite dos cartões de crédito.

- **📅 Orçamento Mensal**:
  - Navegação fluida entre meses e anos (2024 até 2035).
  - Cards de Salário Total, Gastos Totais e indicador dinâmico: **Disponível** (verde) ou **Ultrapassou** (vermelho com o valor excedente).
  - Botões de ação rápida: **Lançar Salário**, **Lançar Gastos**, **+Tag** e **Add Cartão**.
  - Tabela organizada com salários fixados no topo (verde) e gastos abaixo (vermelho).
  - Ordenação dinâmica por Nome, Valor, Tag e Data.
  - Alternância rápida de status em 1 clique (*Pago / Não pago* e *Recebido / Não Recebido*).

- **💳 Cartões de Crédito**:
  - Gestão independente com nome do cartão, limite total, fatura atual e vencimento.
  - Tag automática `Cartão de crédito`.
  - Controle de pagamento de fatura do mês e cálculo automático de limite disponível.

- **📈 Relatórios & Diagnóstico**:
  - Balanço geral com cálculo automático de taxa de poupança (%).
  - Gastos por Categoria / Tag e Salários por Fonte com barras de progresso.
  - Relatório de liquidez (contas já pagas vs. pendentes a vencer, salários recebidos vs. a receber).
  - Exportação instantânea para **CSV (Excel)** e suporte para impressão ou download em **PDF**.

---

## 📦 Como Subir este Projeto para o GitHub

Se você ainda não enviou este código para o seu perfil no GitHub, siga este passo a passo:

### 1. Criar um Repositório no GitHub
1. Acesse [github.com/new](https://github.com/new).
2. Dê um nome ao repositório (por exemplo: `cabe-no-bolso` ou `sistema-cabe-no-bolso`).
3. Escolha **Public** (Público) ou **Private** (Privado).
4. **Não** marque a opção de inicializar com README (pois este projeto já possui todos os arquivos prontos).
5. Clique em **Create repository**.

### 2. Enviar os arquivos pelo Terminal do seu computador

Abra o terminal na pasta do projeto e execute:

```bash
# 1. Inicializar o repositório git
git init

# 2. Adicionar todos os arquivos
git add .

# 3. Criar o primeiro commit
git commit -m "feat: versão inicial do Sistema Cabe no bolso"

# 4. Definir a branch principal como main
git branch -M main

# 5. Conectar com o seu repositório no GitHub (substitua pelo link do seu repositório)
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git

# 6. Enviar o código para o GitHub
git push -u origin main
```

---

## 🌐 Como Hospedar Gratuitamente (Recomendado: Vercel ou Netlify)

### Opção 1: Vercel (Mais rápida e recomendada - 1 clique)
1. Acesse [vercel.com](https://vercel.com) e conecte sua conta do GitHub.
2. Clique em **Add New...** -> **Project**.
3. Selecione o repositório do projeto.
4. O Vercel detecta o Vite automaticamente (`npm run build` e pasta `dist`).
5. Clique em **Deploy** — seu sistema estará no ar com link seguro `https://...` em menos de 1 minuto!

### Opção 2: Netlify
1. Acesse [netlify.com](https://netlify.com) e faça login com seu GitHub.
2. Clique em **Add new site** -> **Import an existing project**.
3. Escolha o repositório. O Netlify preenche o comando `npm run build` e a pasta `dist`.
4. Clique em **Deploy**.

### Opção 3: GitHub Pages
Se preferir usar o GitHub Pages diretamente no repositório:
1. No seu repositório no GitHub, você pode criar uma action oficial do Vite ou rodar `npm run build` e enviar a pasta `dist` para o branch `gh-pages` com o pacote `gh-pages`.
2. Como configuramos `base: './'`, todos os arquivos abrem perfeitamente em qualquer domínio ou subpasta!

---

## 💻 Executando Localmente no seu Computador

Se você quiser rodar ou testar o projeto no seu computador:

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento local
npm run dev

# Gerar build de produção para testar
npm run build

# Pré-visualizar o build localmente
npm run preview
```

---

## 🛠️ Tecnologias Utilizadas

- **React 19** + **TypeScript**
- **Vite** (Build ultrarrápido configurado para deploy estático)
- **Tailwind CSS v4**
- **Lucide React** (Ícones modernos)
- **HTML5 LocalStorage** (Persistência automática dos dados no navegador)
