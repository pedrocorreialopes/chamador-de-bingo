# Chamador de Bingo Digital — Bingo 75

Sistema completo de chamador de bingo eletrônico (75 bolas), feito com **HTML + CSS + JavaScript puro**, executando direto no navegador e com persistência local (offline-friendly).

## Arquivos de entrada
- `index.html` → interface principal
- `style.css` → layout, responsividade, tema visual e modo telão
- `script.js` → lógica de jogo, sorteio, persistência, histórico, pedra maior, configurações e áudio

## Funcionalidades implementadas

### 1) Interface profissional e responsiva
- Layout em cards, visual escuro e contraste alto
- Área central de destaque da bola sorteada
- Botões grandes para operação em eventos
- Responsivo para desktop, tablet e mobile
- Preparado para visualização em telas grandes

### 2) Tabuleiro oficial Bingo 75 (B-I-N-G-O)
- Grade fixa com 75 números, separados por colunas:
  - B: 01–15
  - I: 16–30
  - N: 31–45
  - G: 46–60
  - O: 61–75
- Marcação permanente de bolas já sorteadas
- Destaque da coluna correspondente ao número atual
- Cores por letra (B azul, I vermelho, N dourado, G verde, O roxo)

### 3) Sorteio e regras do jogo
- Embaralhamento com **Fisher-Yates**
- Sem repetição de números
- Sorteio manual e automático
- Botões de controle:
  - INICIAR JOGO
  - PAUSAR
  - CONTINUAR
  - SORTEAR PRÓXIMA BOLA
  - FINALIZAR JOGO
  - NOVO JOGO
- Confirmação para ações destrutivas

### 4) Intervalo e contagem regressiva
- Presets: 5, 8, 10, 15, 20, 30 segundos
- Intervalo personalizado
- Contagem regressiva na interface
- Pausa preserva estado e contagem
- Modo manual com sorteio automático desligado

### 5) Histórico e estatísticas
- Histórico com letra+número em ordem de sorteio
- Último item destacado
- Estatísticas em tempo real:
  - bolas sorteadas
  - bolas restantes
  - percentual concluído
  - tempo de partida
- Barra de progresso

### 6) Pedra Maior (desempate)
- Modal dedicado para desempate
- Cadastro de concorrentes (2 ou mais)
- Adição/remoção de nomes
- Sorteio aleatório de vencedor
- Confirmação para repetir sorteio
- Independente do histórico principal do bingo

### 7) Persistência e recuperação (localStorage)
O sistema salva automaticamente:
- jogo atual (`bingo75.activeGame`)
- backup automático (`bingo75.backupGame`)
- último jogo finalizado (`bingo75.finalizedGame`)
- configurações (`bingo75.settings`)

Salvamentos acontecem em ações-chave: início, sorteio, pausa, continuação, finalização, novo jogo e alterações de configuração.

Recuperação:
- Botão **RECUPERAR ÚLTIMO JOGO** exibe dados da partida encontrada
- Restauração com status, contagem e último número

### 8) Modo Telão / Fullscreen
- Botão **MODO TELÃO**
- Oculta elementos secundários e amplia foco visual
- Tenta entrar em fullscreen com Fullscreen API
- Saída com botão de retorno ou tecla ESC

### 9) Sons opcionais
- Efeitos sonoros com Web Audio API
- Liga/desliga no painel de configurações
- Controle de volume

### 10) Configurações persistentes
- Tempo entre sorteios
- Sorteio automático
- Sons e volume
- Animações e velocidade
- Exibição do histórico
- Confirmação de novo jogo
- Recuperação automática
- Tema visual

## Execução
1. Abra `index.html` diretamente no navegador.
2. Clique em **INICIAR JOGO**.
3. Use os controles para conduzir a partida.

> Não requer servidor backend para funcionar.

## Armazenamento e dados
- Armazenamento local no navegador (localStorage)
- Dados ficam vinculados ao mesmo navegador/perfil/origem
- Limpar dados do navegador remove os estados salvos

## URL pública
- **Ainda não publicado em Hosted Deploy neste momento.**
- O projeto está pronto para execução local via `index.html`.

## Verificação realizada
- Renderização validada em viewport desktop e mobile
- Interface sem vazamento de código na tela

## Próximos passos recomendados
- Adicionar pacote de sons customizados (arquivos de áudio) para assinatura sonora mais rica
- Adicionar exportação/importação de backup JSON manual
- Criar painel de “últimas partidas” com histórico multi-sessão
- Opcional: suporte a múltiplos perfis de operador
