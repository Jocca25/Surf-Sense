# Barlavento

Previsão de surf para a costa de Lisboa. A aplicação lê o mar e o vento hora a hora, dá uma pontuação de 0 a 100 a cada praia e explica, em português, quando vale a pena ir à água.

A pontuação é uma leitura das condições previstas. Não é uma garantia de segurança e não substitui o que vês na praia nem os avisos oficiais.

## O que já funciona

- Oito praias com características próprias: Carcavelos, Guincho, Costa da Caparica, Fonte da Telha, Cresmina, São Pedro do Estoril, Praia Grande e Ribeira d'Ilhas.
- Pesquisa por nome, mapa, ficha de cada praia, favoritos e comparação até três praias.
- Previsão real dos próximos dias: altura e direcção da ondulação, período, ondulação de vento, vento e rajadas, nível do mar do modelo.
- Avisos oficiais do IPMA (amarelo, laranja e vermelho) para Lisboa e Setúbal.
- Vento classificado praia a praia: terral, maral ou cruzado, a partir da direcção de onde o vento vem e da orientação da costa.
- Pontuação hora a hora, ajustada ao nível do surfista (iniciante, intermédio, avançado) e ao tamanho de onda que escolheste.
- Janelas de surf, comparação manhã / tarde / fim de tarde, e frases que usam só os números da previsão.
- Alertas opcionais no browser, sem repetir o mesmo aviso, e silêncio nas horas que definires.
- As horas aparecem no fuso de Lisboa.

## O que ainda precisa de configuração ou de trabalho futuro

- **Maré oficial.** Sem chave da WorldTides, a curva de maré é o nível do mar do modelo Open-Meteo. O zero é o nível médio global do mar, não o zero da Tabela de Marés do Instituto Hidrográfico. As horas de preia-mar e baixa-mar ficam aproximadas à hora do modelo. A aplicação diz isto no ecrã. A tabela oficial do Instituto Hidrográfico é um PDF com direitos de autor e não é copiada para aqui.
- **Alertas com a página fechada.** Os avisos aparecem na aplicação e, se deres permissão, no browser enquanto a página está aberta. Não há envio em segundo plano (isso precisaria de um servidor a acordar sozinho e de chaves de notificação).
- **Notas sobre a sessão.** Quando marcas de 1 a 5 como esteve o mar, a nota fica num ficheiro local. Não altera a pontuação e não treina nenhum modelo.
- **Não há modelo de inteligência artificial treinado.** As frases são regras transparentes sobre os números reais. A arquitectura deixa espaço para, mais tarde, guardar histórico e treinar um modelo.

## Como correr no computador

Precisas de Node.js 22.

```bash
npm install
npm run dev -- --port 43123 --hostname 0.0.0.0
```

Abre [http://127.0.0.1:43123](http://127.0.0.1:43123).

Outros comandos:

```bash
npm test          # testes da pontuação, do vento e dos alertas
npm run lint      # verificação de estilo
npm run build     # versão de produção
npm start -- --port 43123 --hostname 0.0.0.0
```

Não precisas de chave nenhuma para a previsão do mar, do vento e dos avisos.

## Variáveis de ambiente

Copia `.env.example` para `.env.local` só se quiseres mudar alguma coisa. Nada disto é obrigatório.

| Variável | Para que serve |
| --- | --- |
| `WORLDTIDES_API_KEY` | Chave opcional da [WorldTides](https://www.worldtides.info/apidocs). Com ela, a maré passa a ser a previsão desse serviço (datum LAT). A chave fica só no servidor. |
| `FORECAST_CACHE_TTL_SECONDS` | Tempo em memória antes de voltar a pedir as APIs. Por omissão, 30 minutos (mínimo 60 segundos, máximo 6 horas). |
| `OPEN_METEO_MARINE_URL` | Endereço do mar, se precisares de outro. |
| `OPEN_METEO_WEATHER_URL` | Endereço do vento, se precisares de outro. |
| `FEEDBACK_DIR` | Pasta das notas de sessão. Em alojamento sem disco, usa `/tmp`. |

Não commits o ficheiro `.env.local`.

## De onde vêm os números

Nada é inventado. Se um serviço falhar, o ecrã diz o que falta e a pontuação deixa de fora esse factor. Se faltar a altura da onda ou o vento, não há pontuação nessa hora e não sai alerta.

### Open-Meteo (mar e vento)

- Mar: [Marine Weather API](https://open-meteo.com/en/docs/marine-weather-api), sem chave. Pedimos a célula do mar (`cell_selection=sea`), fuso `Europe/Lisbon`, 7 dias: altura significativa, ondulação primária e secundária, ondulação de vento, período, direcção, nível do mar (`sea_level_height_msl`) e temperatura da água.
- Vento: [Forecast API](https://open-meteo.com/en/docs), a 10 metros, em km/h, com rajadas.
- Uso gratuito para fins não comerciais, com atribuição. Há limites de pedidos; por isso a aplicação guarda a resposta cerca de 30 minutos e junta pedidos iguais. Se uma actualização falhar e a última resposta tiver menos de 6 horas, mostramos esses números com a marca de dados antigos e **não** enviamos alertas.
- O nível do mar do modelo mistura maré e pressão atmosférica. Na costa a precisão é limitada. Não serve para navegação.

### IPMA

- Avisos: `https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json`. Só entram amarelo, laranja e vermelho, nas áreas de Lisboa (LSB) e Setúbal (STB).
- Estado do mar diário (3 dias, um ponto para a costa de Lisboa, `globalIdLocal` 1111026): usado como confronto, não como a previsão hora a hora. Se a altura máxima do modelo e o meio do intervalo do IPMA se afastarem mais de 1,5 m no mesmo dia, a hora fica marcada como incerta e não sai alerta.
- Os ficheiros diários podem ainda trazer a data de ontem. Nesse caso não os tratamos como o dia de hoje.
- O IPMA pede que quem usa os dados abertos escreva para webmaster@ipma.pt. Atribuição obrigatória. Os horários dos avisos vêm em UTC.

### WorldTides (opcional, com custo)

A API pede uma chave e tem um plano pago conforme o volume. Sem chave, não fingimos que há uma tabela oficial: usamos o nível do mar do Open-Meteo e dizemos a limitação.

### Instituto Hidrográfico

A Tabela de Marés é a referência oficial em Portugal e está protegida. A API pública do Instituto que consultámos traz observações, não a previsão astronómica. Por isso não a usamos como previsão.

## Como se lê o vento

A direcção meteorológica é de onde o vento **vem**.

Cada praia tem uma orientação: o rumo para onde a costa olha o mar. Vento que vem desse rumo é maral (do mar para terra). Vento que vem do rumo oposto é terral (de terra para o mar). Entre os dois, é cruzado, com nuances (mais maral ou mais terral).

Um terral forte não sobe a pontuação. A partir de cerca de 50 km/h de vento ou 70 km/h de rajada, a hora fica em risco e a pontuação não passa de 39, mesmo com boa ondulação. O vento de cautela (cerca de 35 km/h, ou rajadas de 55) impede a etiqueta "excelente".

A conta foi testada com várias orientações de costa e com a volta da bússola em 0° e 360°.

## Como se calcula a pontuação

Cada hora junta seis factores, com pesos que podes mudar em Preferências:

| Factor | Peso inicial |
| --- | --- |
| Altura da ondulação, face ao teu nível e ao tamanho habitual da praia | 22 |
| Direcção da ondulação face à janela dessa praia | 18 |
| Período | 14 |
| Direcção do vento face à costa | 18 |
| Velocidade e rajadas | 16 |
| Maré (altura e se está a encher ou a vazar) | 12 |

Se um factor não existir, os outros repartem o peso. Uma maré pouco fiável (amplitude quase nula, ou sem preia-mar e baixa-mar) sai da conta.

As faixas iniciais, também editáveis:

- 85–100 excelente
- 65–84 bom
- 40–64 razoável
- 0–39 fraco

A qualidade da onda e o risco estão separados. Uma hora perigosa pode ter onda boa por baixo, mas o número que vês fica limitado e o texto explica o risco. Um iniciante não recebe a mesma recomendação que um surfista avançado com ondas grandes. A Cresmina, por exemplo, não é apresentada como excelente a quem não escolheu o nível avançado.

As janelas são blocos de 2 a 4 horas seguidas com pontuação pelo menos igual ao mínimo que definiste. Se o dia não chega lá, a melhor faixa aparece na mesma, marcada como não recomendada.

## Alertas

Os alertas começam desligados. Quando os ligas, podes escolher praias, pontuação mínima, intervalo de onda, vento máximo, com quantas horas de antecedência queres saber, e horas de silêncio.

Um alerta só sai se a previsão tiver altura, vento, direcção da ondulação e uma maré utilizável, se não estiver desactualizada ou em desacordo forte com o IPMA, e se a hora não estiver em risco. O mesmo aviso não se repete. Se a previsão mudar de forma relevante (pontuação, onda ou vento), o alerta pode ser actualizado. Durante as horas de silêncio fica adiado, não marcado como já enviado.

Há também o endereço `POST /api/alerts/evaluate` para um futuro agendador no servidor usar a mesma regra.

## Páginas

- `/` painel de hoje
- `/praias` pesquisa e mapa
- `/praias/carcavelos` (e as outras praias) ficha com gráfico, maré, janelas e explicação
- `/favoritos`
- `/comparar`
- `/alertas`
- `/preferencias`

## Arquitectura

Next.js (App Router), TypeScript e React. O ecrã pede `GET /api/forecast` e calcula a pontuação no browser, para as tuas preferências mudarem logo a leitura sem novo pedido ao mar.

| Pasta | Papel |
| --- | --- |
| `lib/beaches.ts` | Ficha de cada praia: coordenadas, orientação, ondulação que entra, maré preferida, tamanho habitual |
| `lib/forecast/` | Pedidos ao Open-Meteo, IPMA e WorldTides, validação e cache |
| `lib/wind.ts` e `lib/angles.ts` | Bússola e tipo de vento |
| `lib/scoring.ts` | Pontuação e risco |
| `lib/tides.ts` | Preia-mar, baixa-mar, a encher, a vazar |
| `lib/windows.ts` | Melhores horas |
| `lib/explanations.ts` | Frases a partir dos números |
| `lib/notifications.ts` | Quem recebe alerta e como se evita o duplicado |
| `lib/history.ts` | Tipos prontos para histórico futuro. Ainda não há treino |
| `app/api/feedback` | Guarda a nota da sessão num ficheiro |

As chaves, se existirem, nunca vão para o browser.

## Publicar

Num servidor com Node:

```bash
npm install
npm run build
npm start -- --port 43123 --hostname 0.0.0.0
```

Na Vercel (ou serviço parecido), faz o deploy desta pasta. Define `WORLDTIDES_API_KEY` só se a tiveres, e `FEEDBACK_DIR=/tmp` se quiseres que as notas de sessão não tentem escrever num disco só de leitura. As notas desaparecem quando a máquina reinicia. A previsão em si não precisa de base de dados.

## Próximos passos úteis

1. Ligar a WorldTides, ou outra fonte de maré com zero hidrográfico, quando houver chave.
2. Um pequeno servidor que volte a avaliar os alertas mesmo com o telemóvel fechado.
3. Guardar o histórico da previsão e a nota de quem esteve na água, para mais tarde comparar o modelo com o que aconteceu.
4. Se entrares um modelo de linguagem, ele só deve receber os números já calculados. Não deve inventar mar nem vento.
5. Mais praias, cada uma com a sua orientação. Não reutilizar a ficha de outra praia.
