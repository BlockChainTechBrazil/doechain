# DoeChain - Documentação Técnica para CPSI

## Alinhamento com Edital de Qualificação

Este documento descreve as implementações realizadas para atender aos requisitos do edital CPSI - Centro Paulista de Saúde Integrada.

---

## 1. KPIs Implementados (Dashboard)

### 1.1 Taxa de Automação
- **Campo:** `is_automatic` / `source`
- **Cálculo:** `(notificações automáticas / total) * 100`
- **Fonte:** Integração MV (mock para demonstração)

### 1.2 Tempo Médio de Notificação
- **Campos:** `death_datetime`, `notification_datetime`
- **Cálculo:** Média em minutos entre óbito e notificação ao Banco de Olhos
- **Meta:** < 60 minutos (conforme edital)

### 1.3 Tempo Médio para Consentimento
- **Campos:** `notification_datetime`, `consent_datetime`
- **Cálculo:** Tempo entre notificação e decisão familiar

### 1.4 Tempo Médio para Coleta
- **Campos:** `death_datetime`, `collection_datetime`
- **Cálculo:** Tempo até captação da córnea
- **Janela crítica:** 6 horas após óbito

### 1.5 Taxa de Consentimento
- **Campo:** `family_consent` (1=autorizado, 0=recusado, NULL=pendente)
- **Cálculo:** `(consentimentos autorizados / total decisões) * 100`

### 1.6 Córneas Captadas/Transplantadas
- **Campos:** 
  - `cornea_left_collected`, `cornea_right_collected`
  - `cornea_left_transplanted`, `cornea_right_transplanted`
- **Contagem:** Por olho (esquerdo/direito) e total

---

## 2. Comunicação à Família (Ponto Crítico do Edital)

### 2.1 Problema Identificado
> "A família deve ser comunicada ANTES de deixar a unidade. Após a saída, raramente retornam."

### 2.2 Campos de Rastreamento
```sql
family_notified INTEGER DEFAULT 0,      -- Família comunicada (0/1)
family_notified_at DATETIME,            -- Momento da comunicação
family_notified_by TEXT                 -- Profissional responsável
```

### 2.3 Interface
- Checkbox no formulário: "Família já foi comunicada sobre potencial de doação"
- Alerta visual pulsante quando família ainda não foi comunicada
- Badge na lista de notificações (🔴 Pendente / 🟢 Comunicada)

### 2.4 Alerta Urgente no Dashboard
- Exibe contagem de notificações com família não comunicada
- Notificações dentro da janela de 6h (córneas ainda viáveis)

---

## 3. Rastreabilidade de Córneas

### 3.1 Estados do Processo
```
Óbito → Notificação → Avaliação → Coleta → Transplante
```

### 3.2 Campos de Timestamp
```sql
notification_datetime DATETIME,   -- Momento da notificação
evaluation_datetime DATETIME,     -- Avaliação médica
collection_datetime DATETIME,     -- Captação da córnea
transplant_datetime DATETIME      -- Transplante realizado
```

### 3.3 Endpoints da API
```
PUT /api/notifications/:id/family-notified  → Marca família comunicada
PUT /api/notifications/:id/cornea-status    → Atualiza status (evaluated/collected/transplanted)
```

---

## 4. Dashboard Visual com Chart.js

### 4.1 Gráficos Implementados
1. **Por Fonte** - Manual vs Automático (MV)
2. **Por Status** - Pendente / Concluído / Blockchain
3. **Consentimento** - Autorizado / Recusado / Aguardando

### 4.2 Cards de KPI
- Taxa de Automação (%) com barra de progresso
- Tempo Médio (minutos)
- Taxa de Consentimento (%)
- Córneas Captadas (total)

---

## 5. Integração com Sistema MV (Mock)

### 5.1 Simulação para Demonstração
- 100 óbitos históricos gerados automaticamente
- Dados realistas: idades, gêneros, causas de óbito
- Elegibilidade de córneas calculada por critérios médicos

### 5.2 Fluxo Automático
```
MV detecta óbito → Verifica elegibilidade → Notifica DoeChain → Registra blockchain
```

---

## 6. Blockchain (Ethereum Sepolia)

### 6.1 Contrato: DeathNotificationRegistry
- **Endereço:** `0x690fD2Ee2BAdD99C543b89eEAB9C73C1d8F94E54`
- **Rede:** Sepolia Testnet

### 6.2 Dados Registrados
- Hash do paciente (anonimizado)
- Timestamp do óbito
- ID da instituição
- Status de viabilidade

### 6.3 Links para Auditoria
- Cada transação possui link para Etherscan
- Histórico de transações no dashboard

---

## 7. Estrutura de Banco de Dados

### 7.1 Tabela: death_notifications (campos principais)
```sql
-- Identificação
patient_hash TEXT,
patient_name TEXT,
patient_cpf_encrypted TEXT,

-- Óbito
death_datetime DATETIME,
death_cause TEXT,
pcr_confirmed INTEGER,

-- Córneas
cornea_viable INTEGER,
cornea_left_collected INTEGER,
cornea_right_collected INTEGER,
cornea_left_transplanted INTEGER,
cornea_right_transplanted INTEGER,

-- Família
family_notified INTEGER,
family_notified_at DATETIME,
family_consent INTEGER,
consent_datetime DATETIME,

-- Timestamps de processo
evaluation_datetime DATETIME,
collection_datetime DATETIME,
transplant_datetime DATETIME,

-- Blockchain
blockchain_tx_hash TEXT,
blockchain_confirmed INTEGER
```

---

## 8. Métricas Retornadas pela API

### Endpoint: GET /api/notifications/statistics
```json
{
  "total": 150,
  "automatic": 120,
  "manual": 30,
  "automaticRate": 80.0,
  "avgTimeToNotification": 45,
  "avgTimeToConsent": 180,
  "avgTimeToCollection": 240,
  "corneaViable": 85,
  "corneaCollected": 60,
  "corneaTransplanted": 45,
  "consentGranted": 70,
  "consentRefused": 15,
  "consentPending": 65,
  "consentRate": 82.4,
  "familyNotified": 130,
  "familyNotNotified": 20,
  "urgentNotifications": 5,
  "bySource": { "mv": 120, "manual": 30 },
  "byStatus": { "pending": 40, "completed": 110 },
  "byConsent": { "granted": 70, "refused": 15, "pending": 65 }
}
```

---

## 9. Critérios de Elegibilidade de Córneas

### 9.1 Contraindicações Absolutas
- Causa desconhecida de morte
- HIV/AIDS, Hepatite B/C
- Sepse ativa, Raiva, Creutzfeldt-Jakob
- Leucemia, Linfoma

### 9.2 Contraindicações Oculares
- Cirurgia ocular prévia
- Infecção ocular ativa
- Tumor ocular

### 9.3 Contraindicações Relativas (avaliar)
- Uso de drogas injetáveis
- Tatuagem recente
- Comportamento de risco

---

## 10. Perfis de Usuário

| Perfil | Permissões |
|--------|------------|
| Admin | Acesso total, gestão de usuários |
| SES | Visualização estadual, relatórios |
| Banco de Olhos | Gestão de córneas, atualizações |
| Hospitalar | Notificações da instituição |
| Operador | Apenas notificar |

---

## 11. Próximos Passos (Sugestões)

1. **Alertas por SMS/WhatsApp** para equipe quando óbito detectado
2. **Integração real com MV** (substituir mock)
3. **Dashboard por região/hospital**
4. **Exportação de relatórios em PDF**
5. **App mobile para notificações emergenciais**

---

*Documento gerado para demonstração no CPSI - Sistema DoeChain v1.0*
