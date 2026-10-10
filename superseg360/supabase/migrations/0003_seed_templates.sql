-- SuperSeg 360 :: Módulo Comercial :: 0003 - modelos de texto iniciais
-- ATENÇÃO: todos os modelos nascem como RASCUNHO (minuta provisória). Enquanto não
-- forem revisados e aprovados por um administrador (menu Modelos), o PDF da proposta
-- sai com a marca "MINUTA - NÃO ENVIAR" e o sistema bloqueia o envio ao cliente.
-- Substitua pelos textos reais da proposta 38072 e pelas cláusulas validadas pelo jurídico.
-- Campos disponíveis: {{cliente_razao_social}} {{cliente_nome_fantasia}} {{cliente_cnpj}}
-- {{unidade_nome}} {{numero_proposta}} {{validade}} {{prazo_entrega}} {{valor_total}}
-- {{servicos_resumo}} {{condicoes_pagamento}}

insert into public.document_templates (key, kind, title, body) values
('apresentacao_superseg', 'institutional', 'Apresentação da SuperSeg',
'A SuperSeg Medicina e Segurança do Trabalho atua na gestão integrada de saúde e segurança ocupacional, apoiando empresas no cumprimento da legislação trabalhista e na proteção de seus colaboradores.

Nossa equipe multidisciplinar desenvolve programas, laudos, treinamentos e exames ocupacionais com foco em qualidade técnica, prazo e atendimento próximo.

[TEXTO PROVISÓRIO - substituir pelo texto institucional oficial da proposta 38072]'),

('objeto_proposta', 'institutional', 'Objeto da proposta',
'A presente proposta tem por objeto a prestação, pela SuperSeg Medicina e Segurança do Trabalho, dos serviços de {{servicos_resumo}} a {{cliente_razao_social}}, inscrita no CNPJ {{cliente_cnpj}}, conforme escopo técnico descrito neste documento.'),

('condicoes_pagamento', 'contractual', 'Condições de pagamento (texto de apoio)',
'O investimento total desta proposta é de {{valor_total}}. As condições de pagamento acordadas são: {{condicoes_pagamento}}.

Esta proposta é válida até {{validade}}. O prazo de entrega previsto é de {{prazo_entrega}}, contado a partir da aceitação formal e do recebimento das informações necessárias.'),

('clausulas_contratuais', 'contractual', 'Cláusulas contratuais (MINUTA PROVISÓRIA - requer revisão jurídica)',
'1. DO OBJETO - Os serviços contratados são aqueles descritos no escopo técnico desta proposta {{numero_proposta}}.

2. DAS OBRIGAÇÕES DA CONTRATADA - Executar os serviços com observância das normas regulamentadoras aplicáveis e dos prazos indicados.

3. DAS OBRIGAÇÕES DA CONTRATANTE - Fornecer, em tempo hábil, informações, documentos e acesso aos locais necessários à execução dos serviços.

4. DO PREÇO E DO PAGAMENTO - Conforme seções Investimento e Condições de Pagamento.

5. DA VIGÊNCIA E DA VALIDADE - A proposta tem a validade indicada e, aceita, vigora pelo prazo necessário à conclusão dos serviços.

6. DO FORO - Fica eleito o foro da comarca da sede da CONTRATADA.

[MINUTA PROVISÓRIA - substituir pelas cláusulas oficiais aprovadas pelo jurídico]'),

('formas_aceite', 'contractual', 'Formas de aceite',
'O aceite desta proposta poderá ser formalizado por: (a) assinatura e devolução deste documento; (b) assinatura eletrônica; ou (c) e-mail de confirmação do responsável da CONTRATANTE, citando o número {{numero_proposta}}.

[TEXTO PROVISÓRIO - confirmar formas de aceite com a diretoria]');
