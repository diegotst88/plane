# Decisões técnicas, premissas e pendências

## Decisões tomadas (podem ser revistas)
- **Dinheiro em centavos inteiros**; descontos por item (%) com arredondamento “meio para cima”, igual no app e no banco (testado).
- **“Vencida” é derivada**: proposta *enviada* sem resposta cuja validade já passou (fuso America/Sao_Paulo). Não é um status gravado.
- **Painel conta apenas a versão atual** de cada proposta. Ao criar nova versão de uma proposta aprovada, a v1 deixa de contar como “aprovada”.
- **Numeração**: número sequencial por proposta (ex.: 12) + versão (12/2). Para continuar a série da proposta 38072, ajuste a sequência: `select setval('quote_number_seq', 38072);`
- **Primeiro usuário = administrador**; demais = somente leitura até ajuste.
- **CNPJ alfanumérico** (vigente desde jul/2026) suportado na validação.
- **Consulta pública de CNPJ** via BrasilAPI (botão “Buscar”); falha de rede nunca bloqueia o cadastro manual.

## Pendências para o piloto
1. Substituir minutas dos modelos de texto pelos textos oficiais e aprovar (jurídico).
2. Definir preços/escopos reais do catálogo (iniciaram em R$ 0,00).
3. Logotipo em `public/logo.png` e dados da empresa em `COMPANY_*`.
4. Receber o PDF da proposta 38072 (não estava no ambiente) para ajuste fino de layout/tipografia.
5. Criar projeto Supabase real e publicar (guia do proprietário). **Os testes automatizados e de navegador rodaram contra PostgreSQL + PostgREST locais, não contra um projeto Supabase de verdade.**
6. Decidir visibilidade por vendedor (hoje todos veem tudo) e política de desconto.

## Fora do escopo desta fase (por pedido)
Integrações Conta Azul, ClickUp, SOC, WhatsApp, E-mail, ZapSign e Agentes de IA — apenas a estrutura (fila de eventos, estado por provedor, referências externas, contratos TypeScript).

## Riscos conhecidos
- `npm audit` aponta o PostCSS embutido no Next 15 (uso apenas em build, sem CSS de terceiros). Resolver na migração para Next 16.
- PDF gerado em tempo real a cada abertura (rápido para o volume do piloto); cache/armazenamento pode ser adicionado depois.
