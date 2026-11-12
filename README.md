# BJJ Tracker — plugin para Obsidian

Registre seus **treinos**, **posições/técnicas**, **drills** e **metas** de Jiu-Jitsu como notas do Obsidian,
e acompanhe tudo em um painel com estatísticas.

## Instalação

```bash
npm install
npm run build
VAULT=/caminho/do/seu/vault npm run install-vault
```

Depois, no Obsidian: **Configurações → Plugins da comunidade → ativar "BJJ Tracker"**.
(Manualmente: copie `main.js`, `manifest.json` e `styles.css` para `<vault>/.obsidian/plugins/bjj-tracker/`.)

Para desenvolver: `npm run dev` recompila a cada alteração (use o plugin *Hot Reload* para recarregar sozinho).

## O que ele faz

| Nota | Criada por | Pasta padrão | Campos principais |
|---|---|---|---|
| Treino | `Registrar treino` | `BJJ/Treinos` | data, tipo (Gi/No-Gi/…), duração, intensidade, rolas, finalizações, técnicas, drills, lesões |
| Posição | `Nova posição / técnica` | `BJJ/Posições` | categoria, perspectiva (por cima/baixo), nível de domínio 1–5, vídeo, relacionadas |
| Drill | `Novo drill` | `BJJ/Drills` | posições, séries × reps, tempo, frequência semanal, histórico de execuções |
| Meta | `Nova meta` | `BJJ/Metas` | categoria, horizonte (curto/médio/longo), prazo, status, forma de medir |

Cada nota é Markdown comum com propriedades (frontmatter). O campo `bjj:` identifica o tipo, então você pode
mover as notas para qualquer pasta ou editá-las à mão.

### Painel
Ícone de espadas na barra lateral ou comando **BJJ Tracker: Abrir painel**. Mostra:
- faixa e graus atuais, tempo na graduação e treinos desde então;
- treinos na semana (vs. meta semanal), mês, ano, total de horas e **sequência de semanas** batendo a meta;
- rolas e finalizações no mês;
- **heatmap** das últimas 26 semanas e tempo por tipo de treino;
- **metas ativas** com barra de progresso, prazo e botões *concluir* / *+1*;
- **drills da semana** (feitos × alvo) com botão para registrar execução;
- **repertório** de posições por nível e categoria, e sugestões do que **revisar**;
- técnicas mais treinadas e últimos treinos.

### Progresso das metas
- **Checklist** — conta as tarefas `- [ ]` / `- [x]` da própria nota.
- **Número de treinos / Horas de tatame** — calculado automaticamente a partir dos treinos entre `inicio` e `prazo`.
- **Manual** — contador `progresso`, incrementado pelo botão *+1* do painel.

### Comandos
- Abrir painel · Registrar treino · Nova posição / técnica · Novo drill · Nova meta
- Registrar execução de drill (hoje)
- Alterar nível de domínio de uma posição (usa a nota aberta, se for uma posição)
- Concluir meta (usa a nota aberta, se for uma meta)

### Painel dentro de uma nota
Use um bloco de código `bjj`. Vazio mostra tudo; ou liste as seções desejadas:

````markdown
```bjj
resumo
metas
drills
```
````

Seções: `resumo`, `heatmap`, `metas`, `drills`, `posicoes`, `tecnicas`, `recentes`.

## Configurações
Faixa, graus e data da graduação; academia, instrutor, tipo e duração padrão do treino; meta de treinos por
semana; nomes das pastas; abrir ou não a nota após criar.
