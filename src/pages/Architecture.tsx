import React from 'react';
import Navbar from '@/components/Navbar';
import ArchitectureDiagram from '@/components/ArchitectureDiagram';
import CodeBlock from '@/components/CodeBlock';
import Footer from '@/components/Footer';

const rustWebhookCode = `use axum::{
    extract::State,
    http::StatusCode,
    routing::post,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use tokio::sync::broadcast;
use std::sync::Arc;

#[derive(Clone)]
struct AppState {
    tx_sender: broadcast::Sender<VerifiedTransaction>,
    db_pool: sqlx::PgPool,
    redis: redis::Client,
}

#[derive(Debug, Deserialize)]
struct MpesaCallback {
    #[serde(rename = "TransactionType")]
    transaction_type: String,
    #[serde(rename = "TransID")]
    trans_id: String,
    #[serde(rename = "TransAmount")]
    trans_amount: f64,
    #[serde(rename = "BusinessShortCode")]
    business_short_code: String,
    #[serde(rename = "BillRefNumber")]
    bill_ref_number: String,
    #[serde(rename = "TransTime")]
    trans_time: String,
}

#[derive(Debug, Serialize, Clone)]
struct VerifiedTransaction {
    hash: String,
    till_number: String,
    amount: f64,
    timestamp: i64,
    fraud_score: f32,
}

// High-speed webhook handler - target: <100ms
async fn mpesa_webhook(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<MpesaCallback>,
) -> Result<StatusCode, StatusCode> {
    let start = std::time::Instant::now();
    
    // 1. Generate immutable hash
    let hash_input = format!(
        "{}{}{}",
        payload.business_short_code,
        payload.trans_amount,
        payload.trans_time
    );
    let hash = format!("{:x}", Sha256::digest(hash_input.as_bytes()));
    
    // 2. Run fraud detection (Candle ML inference)
    let fraud_score = detect_fraud(&payload).await;
    
    // 3. Store in PostgreSQL + Redis cache
    let tx = VerifiedTransaction {
        hash: hash.clone(),
        till_number: payload.business_short_code.clone(),
        amount: payload.trans_amount,
        timestamp: chrono::Utc::now().timestamp(),
        fraud_score,
    };
    
    // Parallel: DB insert + Redis cache + Blockchain anchor
    tokio::join!(
        store_transaction(&state.db_pool, &tx),
        cache_transaction(&state.redis, &tx),
        anchor_to_base_l2(&hash),
    );
    
    // 4. Push Truth Ping via WebSocket
    let _ = state.tx_sender.send(tx);
    
    tracing::info!(
        "Verified in {:?}ms | Till: {} | Amount: {}",
        start.elapsed().as_millis(),
        payload.business_short_code,
        payload.trans_amount
    );
    
    Ok(StatusCode::OK)
}

#[tokio::main]
async fn main() {
    let (tx_sender, _) = broadcast::channel(1000);
    
    let app = Router::new()
        .route("/webhook/mpesa", post(mpesa_webhook))
        .route("/ws/transactions", get(ws_handler))
        .with_state(Arc::new(AppState { 
            tx_sender,
            db_pool: create_pool().await,
            redis: create_redis_client(),
        }));
    
    axum::Server::bind(&"0.0.0.0:8080".parse().unwrap())
        .serve(app.into_make_service())
        .await
        .unwrap();
}`;

const sqlSchemaCode = `-- PostgreSQL Schema for payChainKE

-- Core transactions table with optimized indexing
CREATE TABLE transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hash            VARCHAR(64) NOT NULL UNIQUE,
    till_number     VARCHAR(20) NOT NULL,
    amount          DECIMAL(15, 2) NOT NULL,
    phone_hash      VARCHAR(64), -- Privacy: hashed phone number
    trans_time      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    
    -- Verification status
    status          VARCHAR(20) DEFAULT 'pending',
    fraud_score     REAL DEFAULT 0.0,
    blockchain_tx   VARCHAR(66), -- Base L2 tx hash
    
    -- Indexing for high-speed queries
    CONSTRAINT valid_status CHECK (status IN ('pending', 'verified', 'flagged'))
);

-- Optimized indexes for common query patterns
CREATE INDEX idx_transactions_till ON transactions(till_number, created_at DESC);
CREATE INDEX idx_transactions_status ON transactions(status) WHERE status = 'pending';
CREATE INDEX idx_transactions_fraud ON transactions(fraud_score) WHERE fraud_score > 0.7;

-- Merchants table
CREATE TABLE merchants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    till_number     VARCHAR(20) UNIQUE NOT NULL,
    business_name   VARCHAR(255) NOT NULL,
    location        VARCHAR(100), -- e.g., "Eastleigh", "CBD"
    etims_pin       VARCHAR(20), -- KRA eTIMS integration
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    is_active       BOOLEAN DEFAULT TRUE
);

-- Fraud patterns for ML training
CREATE TABLE fraud_patterns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_type    VARCHAR(50) NOT NULL,
    pattern_data    JSONB NOT NULL,
    confidence      REAL NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log for compliance
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action          VARCHAR(50) NOT NULL,
    entity_type     VARCHAR(50) NOT NULL,
    entity_id       UUID NOT NULL,
    details         JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);`;

const redisSchemaCode = `# Redis Schema for Real-Time Cache

# Recent transactions by Till (sorted set)
# Key: txns:{till_number}
# Score: Unix timestamp
# Value: Transaction hash
ZADD txns:174379 1704067200 "0x7f2c...a3b1"

# Active WebSocket sessions
# Key: ws:sessions
# Field: Session ID
# Value: Till number
HSET ws:sessions "sess_abc123" "174379"

# Fraud score cache (expires after 1 hour)
# Key: fraud:{phone_hash}
# Value: Cumulative fraud score
SETEX fraud:sha256_phone_hash 3600 "0.35"

# Rate limiting per Till
# Key: rate:{till_number}
# Value: Request count (expires per minute)
INCR rate:174379
EXPIRE rate:174379 60

# Transaction status pub/sub channel
# Channel: tx:verified
PUBLISH tx:verified '{"hash":"0x...","till":"174379","amount":2500}'`;

const Architecture: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              System Architecture
            </h1>
            <p className="text-lg text-muted-foreground">
              Technical deep-dive into payChainKE's high-performance payment verification engine.
            </p>
          </div>

          {/* Architecture Diagram */}
          <section className="mb-12">
            <ArchitectureDiagram />
          </section>

          {/* Mermaid Diagram */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">Data Flow Diagram</h2>
            <div className="rounded-xl border border-border bg-card p-6 overflow-x-auto">
              <pre className="text-sm font-mono text-muted-foreground whitespace-pre">
{`sequenceDiagram
    participant M as M-Pesa API
    participant W as Rust Webhook (Axum)
    participant F as Fraud AI (Candle)
    participant DB as PostgreSQL
    participant R as Redis
    participant BC as Base L2
    participant POS as Merchant POS

    M->>W: POST /webhook/mpesa
    W->>W: SHA256(TillID || Amount || Time)
    par Parallel Processing
        W->>F: Analyze transaction pattern
        W->>DB: INSERT transaction
        W->>R: SETEX fraud cache
        W->>BC: Anchor hash on-chain
    end
    F-->>W: fraud_score: 0.02
    W->>POS: WebSocket: VERIFIED ✓
    Note over POS: Truth Ping in <100ms`}
              </pre>
            </div>
          </section>

          {/* Rust Code */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">
              Rust Webhook Handler
            </h2>
            <p className="text-muted-foreground mb-4">
              High-performance M-Pesa callback processor using Axum + Tokio for async concurrency.
            </p>
            <CodeBlock 
              code={rustWebhookCode}
              language="rust"
              title="src/handlers/webhook.rs"
            />
          </section>

          {/* Database Schema */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">
              PostgreSQL Schema
            </h2>
            <p className="text-muted-foreground mb-4">
              Optimized schema with indexes for high-speed Till lookups and fraud detection queries.
            </p>
            <CodeBlock 
              code={sqlSchemaCode}
              language="sql"
              title="migrations/001_initial_schema.sql"
            />
          </section>

          {/* Redis Schema */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">
              Redis Cache Design
            </h2>
            <p className="text-muted-foreground mb-4">
              Real-time caching layer for sub-millisecond lookups and WebSocket session management.
            </p>
            <CodeBlock 
              code={redisSchemaCode}
              language="bash"
              title="redis-schema.txt"
            />
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Architecture;
