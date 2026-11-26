# DER — Pet Shop

Diagrama Entidade-Relacionamento do banco de dados PostgreSQL.

```mermaid
erDiagram
    CLIENTES ||--o{ ANIMAIS : possui
    CLIENTES ||--o{ VENDAS : realiza
    ANIMAIS ||--o{ AGENDAMENTOS : recebe
    SERVICOS ||--o{ AGENDAMENTOS : "é agendado em"
    VENDAS ||--o{ ITENS_VENDA : contém
    PRODUTOS ||--o{ ITENS_VENDA : "compõe"
    PRODUTOS ||--o{ MOVIMENTACOES_ESTOQUE : gera

    CLIENTES {
        int id_cliente PK
        varchar nome_completo
        varchar cpf UK
        varchar telefone
        varchar email
        text endereco
        timestamp criado_em
    }

    ANIMAIS {
        int id_animal PK
        varchar nome
        varchar especie
        varchar raca
        date data_nascimento
        numeric peso
        char sexo
        int id_cliente FK
    }

    PRODUTOS {
        int id_produto PK
        varchar nome
        varchar categoria
        text descricao
        numeric preco_venda
        int quantidade_estoque
        int estoque_minimo
    }

    SERVICOS {
        int id_servico PK
        varchar nome UK
        text descricao
        numeric preco
        int duracao_minutos
    }

    AGENDAMENTOS {
        int id_agendamento PK
        int id_animal FK
        int id_servico FK
        date data_agendamento
        time horario
        varchar status
        text observacoes
    }

    VENDAS {
        int id_venda PK
        int id_cliente FK
        timestamp data_venda
        numeric valor_total
        varchar status
        text observacoes
    }

    ITENS_VENDA {
        int id_item PK
        int id_venda FK
        int id_produto FK
        int quantidade
        numeric preco_unitario
    }

    MOVIMENTACOES_ESTOQUE {
        int id_movimentacao PK
        int id_produto FK
        int quantidade_anterior
        int quantidade_atual
        int diferenca
        varchar tipo_movimentacao
        timestamp data_movimentacao
    }
```

## Regras de integridade representadas

- Um cliente possui **vários** animais e **várias** vendas.
- Um animal pode ter **vários** agendamentos; cada agendamento refere-se a **um** serviço.
- Uma venda possui **vários** itens; cada item refere-se a **um** produto.
- Cada produto gera **várias** movimentações de estoque (via trigger).
- `vendas.status`: `pendente`, `finalizada` ou `cancelada`.
- `agendamentos.status`: `agendado`, `concluido` ou `cancelado`.
- Chaves estrangeiras usam `ON DELETE CASCADE` quando o registro filho não faz sentido sem o pai
  (animais, agendamentos, itens e movimentações) e `ON DELETE RESTRICT` para preservar histórico
  (vendas e serviços).
