# Stellar Instaward — Round Two: settlement rules, redemption and stress test

All of this is **Stellar testnet** and a **simulated** M-PESA B2C leg. No real money moves and no NCBA rail is touched.
It is available only to Stellar pilot merchants (the admin-created `isDemoMerchant` accounts) and the UI lives in the demo app
(`apps/demo`, Inflation Shield page). The real merchant dashboard and mobile app are unchanged.

## Deliverable 1 — Settlement rule configuration

| Requirement | Where |
|---|---|
| Percentage-split fields on the merchant schema | `backend/models/Merchant.js` → `settlementRule { enabled, stellarSharePercent }` |
| Backend calculates the split on incoming payments | `backend/services/stellarSettlementService.js` (`computeSplit`, `applySettlementSplit`), hooked after the KES credit in `services/ncbaLedgerService.js` (`creditNcbaCollection`) and the two STK settlement paths in `controllers/mpesaController.js` |
| Slider + save in the merchant UI | `apps/demo/src/components/stellar/SettlementRuleCard.jsx` (on the Inflation Shield page) |
| API | `GET/PUT /api/transactions/settlement-rule` |

Design notes: the split runs *after* the KES credit and detached, so a slow Stellar network can never delay or break a payment
notification. A unique index makes a webhook retry a no-op (one split per incoming payment). Non-pilot merchants are never affected.

## Deliverable 2 — Withdraw / Redeem

| Requirement | Where |
|---|---|
| Verify balance, sign a Stellar debit, generate a receipt hash | `redeemToMpesa` in the same service (on-chain balance check, `swapUsdcToKesOnChain`, SHA-256 receipt over canonical JSON) |
| Simulated Safaricom B2C payload/response | `buildSimulatedB2C` (Daraja-shaped; callback URLs on the reserved `.invalid` TLD so nothing can be sent) |
| "Request Payout" modal with loading/success states | `apps/demo/src/components/stellar/RequestPayoutModal.jsx` |
| Reconciliation table linked to StellarExpert + download | `ReconciliationTable.jsx`, `GET /api/transactions/wallet/reconciliation(.csv)` |
| API | `POST /api/transactions/wallet/redeem` |

## Error handling (verified in the stress test)

- Low balance → `INSUFFICIENT_USDC`, nothing moves.
- Stellar RPC timeout → the entry is marked **unconfirmed**; KES is *not* auto-refunded (the transaction may still land, and refunding could pay twice). It stays visible for reconciliation.
- Definitive rejection (e.g. master wallet underfunded) → marked **failed** and the KES is returned.
- Duplicate webhook → rejected; double-click on Request Payout → rejected (20 s guard).

## Stress test

`backend/scripts/stellar-stress-test.js` — 50 operations across 5 pilot merchants (one control merchant with the rule off).
It refuses to run against anything but a local database.

```
STRESS_MONGO_URI="mongodb://127.0.0.1:27017/stellar_stress?replicaSet=rs" \
  node backend/scripts/stellar-stress-test.js --mode=live --out=report.md     # real testnet
  node backend/scripts/stellar-stress-test.js --mode=mock                     # no network
```

Invariants checked after the run: KES conservation per merchant, on-chain USDC equals the ledger for every wallet, every
receipt hash present/recomputable, control merchant never settles, duplicates rejected, CSV contains StellarExpert links.
Unit tests: `backend/__tests__/stellarSettlement.test.js`.

### Live testnet run


- Operations run: **50** across **5** pilot merchants
- Confirmed Stellar testnet transactions: **36**
- Invariant failures: **0**

| # | Operation | Pilot | Outcome |
|---|-----------|-------|---------|
| 1 | payment (split) | 1 | completed 20% = KES 300 -> 2.3076923 USDC |
| 2 | payment (split) | 2 | completed 50% = KES 1600 -> 12.3076923 USDC |
| 3 | payment (split) | 3 | completed 80% = KES 6240 -> 48 USDC |
| 4 | payment (split) | 4 | completed 20% = KES 2400 -> 18.4615385 USDC |
| 5 | payment (rule off) | 5 | net KES 950 kept liquid |
| 6 | payment (split) | 1 | completed 20% = KES 640 -> 4.9230769 USDC |
| 7 | payment (split) | 2 | completed 50% = KES 3900 -> 30 USDC |
| 8 | payment (split) | 3 | completed 80% = KES 9600 -> 73.8461538 USDC |
| 9 | payment (split) | 4 | completed 20% = KES 190 -> 1.4615385 USDC |
| 10 | payment (rule off) | 5 | net KES 20000 kept liquid |
| 11 | payment (split) | 1 | completed 20% = KES 1560 -> 12 USDC |
| 12 | payment (split) | 2 | completed 50% = KES 6000 -> 46.1538462 USDC |
| 13 | payment + RPC TIMEOUT | 3 | handled: unconfirmed |
| 14 | payment (split) | 4 | completed 20% = KES 4000 -> 30.7692308 USDC |
| 15 | payment (rule off) | 5 | net KES 1500 kept liquid |
| 16 | payment (split) | 1 | completed 20% = KES 2400 -> 18.4615385 USDC |
| 17 | payment (split) | 2 | completed 50% = KES 475 -> 3.6538462 USDC |
| 18 | payment (split) | 3 | completed 80% = KES 16000 -> 123.0769231 USDC |
| 19 | payment (split) | 4 | completed 20% = KES 300 -> 2.3076923 USDC |
| 20 | payment (rule off) | 5 | net KES 3200 kept liquid |
| 21 | payment (split) | 1 | completed 20% = KES 190 -> 1.4615385 USDC |
| 22 | payment + master underfunded | 2 | handled: failed, KES refunded |
| 23 | payment (split) | 3 | completed 80% = KES 1200 -> 9.2307692 USDC |
| 24 | payment (split) | 4 | completed 20% = KES 640 -> 4.9230769 USDC |
| 25 | payment (rule off) | 5 | net KES 7800 kept liquid |
| 26 | payment (split) | 1 | completed 20% = KES 4000 -> 30.7692308 USDC |
| 27 | payment (split) | 2 | completed 50% = KES 750 -> 5.7692308 USDC |
| 28 | payment (split) | 3 | completed 80% = KES 2560 -> 19.6923077 USDC |
| 29 | payment (split) | 4 | completed 20% = KES 1560 -> 12 USDC |
| 30 | payment (rule off) | 5 | net KES 12000 kept liquid |
| 31 | redeem -> simulated M-Pesa | 1 | KES 2272.5 to 0701 *** 000 |
| 32 | redeem -> simulated M-Pesa | 1 | KES 1704.38 to 0701 *** 000 |
| 33 | redeem -> simulated M-Pesa | 1 | KES 1278.28 to 0701 *** 000 |
| 34 | redeem -> simulated M-Pesa | 2 | KES 3181.26 to 0701 *** 001 |
| 35 | redeem -> simulated M-Pesa | 2 | KES 2385.94 to 0701 *** 001 |
| 36 | redeem -> simulated M-Pesa | 2 | KES 1789.45 to 0701 *** 001 |
| 37 | redeem -> simulated M-Pesa | 3 | KES 8899.99 to 0701 *** 002 |
| 38 | redeem -> simulated M-Pesa | 3 | KES 6675.01 to 0701 *** 002 |
| 39 | redeem -> simulated M-Pesa | 3 | KES 5006.25 to 0701 *** 002 |
| 40 | redeem -> simulated M-Pesa | 4 | KES 2272.5 to 0701 *** 003 |
| 41 | redeem -> simulated M-Pesa | 4 | KES 1704.38 to 0701 *** 003 |
| 42 | redeem -> simulated M-Pesa | 4 | KES 1278.28 to 0701 *** 003 |
| 43 | redeem (no USDC) | 5 | rejected: INSUFFICIENT_USDC |
| 44 | redeem (no USDC) | 5 | rejected: INSUFFICIENT_USDC |
| 45 | redeem (no USDC) | 5 | rejected: INSUFFICIENT_USDC |
| 46 | redeem over balance | 1 | rejected: INSUFFICIENT_USDC |
| 47 | redeem over balance | 2 | rejected: INSUFFICIENT_USDC |
| 48 | redeem + RPC TIMEOUT | 4 | handled: RPC_TIMEOUT |
| 49 | redeem -> simulated M-Pesa | 1 | KES 383.49 to 0701 *** 000 |
| 50 | redeem -> simulated M-Pesa | 3 | KES 1501.88 to 0701 *** 002 |

## Transaction hashes

- Pilot 1 · split_settlement · 2.3076923 USDC · [11d70afef55258cc450724d46cee9e1d5665903396a322fd8cedf1dc034c5d4c](https://stellar.expert/explorer/testnet/tx/11d70afef55258cc450724d46cee9e1d5665903396a322fd8cedf1dc034c5d4c)
- Pilot 1 · split_settlement · 4.9230769 USDC · [a206f115e7a9f448517209f45f8a52f079115f5359a98fe51d058ddeee2f6174](https://stellar.expert/explorer/testnet/tx/a206f115e7a9f448517209f45f8a52f079115f5359a98fe51d058ddeee2f6174)
- Pilot 1 · split_settlement · 12 USDC · [8b3724ad23e2039dd1d3a655e3bc435a9e9a5460dcc612eb973d4a10d4610467](https://stellar.expert/explorer/testnet/tx/8b3724ad23e2039dd1d3a655e3bc435a9e9a5460dcc612eb973d4a10d4610467)
- Pilot 1 · split_settlement · 18.4615385 USDC · [3ea3deef3bd9b7d9c7444f7b79c91069947131c7477fb64deefad64c3c21997e](https://stellar.expert/explorer/testnet/tx/3ea3deef3bd9b7d9c7444f7b79c91069947131c7477fb64deefad64c3c21997e)
- Pilot 1 · split_settlement · 1.4615385 USDC · [94005b6918b823bbe14c271c76a68eeb36ca113fd185b245a491f0952ddcab74](https://stellar.expert/explorer/testnet/tx/94005b6918b823bbe14c271c76a68eeb36ca113fd185b245a491f0952ddcab74)
- Pilot 1 · split_settlement · 30.7692308 USDC · [63f7a6e677e998676582bca179b093c109a3cbc9f0a479011ef796256a9abeb5](https://stellar.expert/explorer/testnet/tx/63f7a6e677e998676582bca179b093c109a3cbc9f0a479011ef796256a9abeb5)
- Pilot 1 · redemption · 17.4808 USDC · [7e8d9fdac15be82404e619f3857e8149ccabd47774f525ec3207266056e2e1e5](https://stellar.expert/explorer/testnet/tx/7e8d9fdac15be82404e619f3857e8149ccabd47774f525ec3207266056e2e1e5)
- Pilot 1 · redemption · 13.1106 USDC · [ed0681089eb070bdcc57c408078bbe2d8e67fd77cb2d99572959bed4631b06bc](https://stellar.expert/explorer/testnet/tx/ed0681089eb070bdcc57c408078bbe2d8e67fd77cb2d99572959bed4631b06bc)
- Pilot 1 · redemption · 9.8329 USDC · [881f361abb37629b8502a0d869560a2850fda314b9ca32224ef0ec3ca17f2f66](https://stellar.expert/explorer/testnet/tx/881f361abb37629b8502a0d869560a2850fda314b9ca32224ef0ec3ca17f2f66)
- Pilot 1 · redemption · 2.9499 USDC · [d432cd7134c0b3dd63c7262a07d697128404d58003b3c05468a370a42c77b4ce](https://stellar.expert/explorer/testnet/tx/d432cd7134c0b3dd63c7262a07d697128404d58003b3c05468a370a42c77b4ce)
- Pilot 2 · split_settlement · 12.3076923 USDC · [96e98e6e5314bc94456b28f147b3db19ee511ba56949c49a363fda47efbe0926](https://stellar.expert/explorer/testnet/tx/96e98e6e5314bc94456b28f147b3db19ee511ba56949c49a363fda47efbe0926)
- Pilot 2 · split_settlement · 30 USDC · [235527ea030dc3e02dd10579b9c191b202e8e423cd3eb1209f0ebb0ff876bc73](https://stellar.expert/explorer/testnet/tx/235527ea030dc3e02dd10579b9c191b202e8e423cd3eb1209f0ebb0ff876bc73)
- Pilot 2 · split_settlement · 46.1538462 USDC · [b3c54fc1ff29378f16c0c4d3ee62641b6d93cf17b6859100e937b4c9a305cd4f](https://stellar.expert/explorer/testnet/tx/b3c54fc1ff29378f16c0c4d3ee62641b6d93cf17b6859100e937b4c9a305cd4f)
- Pilot 2 · split_settlement · 3.6538462 USDC · [3d745e690ad26e290962e8d6c08486bb9734bfcc8473ec856e7a00096bed9476](https://stellar.expert/explorer/testnet/tx/3d745e690ad26e290962e8d6c08486bb9734bfcc8473ec856e7a00096bed9476)
- Pilot 2 · split_settlement · 5.7692308 USDC · [af05a92f8a89f929f664bd8b47c751548484a9ccc19c0806f8488315e960b8b1](https://stellar.expert/explorer/testnet/tx/af05a92f8a89f929f664bd8b47c751548484a9ccc19c0806f8488315e960b8b1)
- Pilot 2 · redemption · 24.4712 USDC · [51580f83c7bcdc528e91949c689c1a847005b112477eab8117486c149a5890c0](https://stellar.expert/explorer/testnet/tx/51580f83c7bcdc528e91949c689c1a847005b112477eab8117486c149a5890c0)
- Pilot 2 · redemption · 18.3534 USDC · [6a9acf7d78cbb5e921102f740bc2b434fcfbaf6d1369ff07b8cc2cdf20eeb22f](https://stellar.expert/explorer/testnet/tx/6a9acf7d78cbb5e921102f740bc2b434fcfbaf6d1369ff07b8cc2cdf20eeb22f)
- Pilot 2 · redemption · 13.765 USDC · [6635aa37672b1b1da5ff6672460dd4adab35c0f32c004824d3a854ea68c35c86](https://stellar.expert/explorer/testnet/tx/6635aa37672b1b1da5ff6672460dd4adab35c0f32c004824d3a854ea68c35c86)
- Pilot 3 · split_settlement · 48 USDC · [b42a1572b22b043b78a99993af82eb605e8d28a42ba8429e709efdaf9531a7f8](https://stellar.expert/explorer/testnet/tx/b42a1572b22b043b78a99993af82eb605e8d28a42ba8429e709efdaf9531a7f8)
- Pilot 3 · split_settlement · 73.8461538 USDC · [bc931fbbcffdaaf68cdf1bd0a4196506d781491df0f15741f16ad8c398007f81](https://stellar.expert/explorer/testnet/tx/bc931fbbcffdaaf68cdf1bd0a4196506d781491df0f15741f16ad8c398007f81)
- Pilot 3 · split_settlement · 123.0769231 USDC · [89984a460f78bed337140f2de3a830df645792ca4c3d32de03d2a71b582d9667](https://stellar.expert/explorer/testnet/tx/89984a460f78bed337140f2de3a830df645792ca4c3d32de03d2a71b582d9667)
- Pilot 3 · split_settlement · 9.2307692 USDC · [c3bbb42b5d208f4c53182c357e92c08f54e22283132904804fc36b811ceafa9b](https://stellar.expert/explorer/testnet/tx/c3bbb42b5d208f4c53182c357e92c08f54e22283132904804fc36b811ceafa9b)
- Pilot 3 · split_settlement · 19.6923077 USDC · [81fc8a80f4332ee8b7808d2d53a8ff2442b9ef9cb62e12cc43f180ced71111a7](https://stellar.expert/explorer/testnet/tx/81fc8a80f4332ee8b7808d2d53a8ff2442b9ef9cb62e12cc43f180ced71111a7)
- Pilot 3 · redemption · 68.4615 USDC · [233ada0c78867554661d5f0863b3669f8c3bfc5973f04f772fd3e478d5a82d2e](https://stellar.expert/explorer/testnet/tx/233ada0c78867554661d5f0863b3669f8c3bfc5973f04f772fd3e478d5a82d2e)
- Pilot 3 · redemption · 51.3462 USDC · [fc0d75ba08facd1fc393def0953fb2cfa2eadfd87e5a313f8275f3b4da1a687a](https://stellar.expert/explorer/testnet/tx/fc0d75ba08facd1fc393def0953fb2cfa2eadfd87e5a313f8275f3b4da1a687a)
- Pilot 3 · redemption · 38.5096 USDC · [5af7feac19d308af683b74e6eb1d958779cbf6ad8014f095a0fbed9d114645c3](https://stellar.expert/explorer/testnet/tx/5af7feac19d308af683b74e6eb1d958779cbf6ad8014f095a0fbed9d114645c3)
- Pilot 3 · redemption · 11.5529 USDC · [acfbc7673e52156c4b21011025815a0ab1aeb95097ecea67b70a4a7a5758ba5f](https://stellar.expert/explorer/testnet/tx/acfbc7673e52156c4b21011025815a0ab1aeb95097ecea67b70a4a7a5758ba5f)
- Pilot 4 · split_settlement · 18.4615385 USDC · [c3c5231728a5f2ba3f3d813b4942d17cd14245a7f922a436b5499f811865baa7](https://stellar.expert/explorer/testnet/tx/c3c5231728a5f2ba3f3d813b4942d17cd14245a7f922a436b5499f811865baa7)
- Pilot 4 · split_settlement · 1.4615385 USDC · [1202750ce45f499111ffc24979f278f79b0d527c609de87f2ec02ba6170775fd](https://stellar.expert/explorer/testnet/tx/1202750ce45f499111ffc24979f278f79b0d527c609de87f2ec02ba6170775fd)
- Pilot 4 · split_settlement · 30.7692308 USDC · [ff2a33a51887f23a6486fa81ae21c6a2f05b62652899cfe0222dac402a79e09e](https://stellar.expert/explorer/testnet/tx/ff2a33a51887f23a6486fa81ae21c6a2f05b62652899cfe0222dac402a79e09e)
- Pilot 4 · split_settlement · 2.3076923 USDC · [8de2bf0d4e76e4ea2c9abd96ac3dc8ae05c9acc79c50682be18e77186be38da8](https://stellar.expert/explorer/testnet/tx/8de2bf0d4e76e4ea2c9abd96ac3dc8ae05c9acc79c50682be18e77186be38da8)
- Pilot 4 · split_settlement · 4.9230769 USDC · [2b8f85e88b32952ae2ee67e808de9426000e49bbce8c259d1c846a19b15adc35](https://stellar.expert/explorer/testnet/tx/2b8f85e88b32952ae2ee67e808de9426000e49bbce8c259d1c846a19b15adc35)
- Pilot 4 · split_settlement · 12 USDC · [1e130c7adf99d849dd324737cfff78f27fec89c8c6d0f0f9f4dfd471e3d2a137](https://stellar.expert/explorer/testnet/tx/1e130c7adf99d849dd324737cfff78f27fec89c8c6d0f0f9f4dfd471e3d2a137)
- Pilot 4 · redemption · 17.4808 USDC · [9dc0202f635b9199d29f697e376f7b74808b2fb6f92dc7baafbba77895a08bdd](https://stellar.expert/explorer/testnet/tx/9dc0202f635b9199d29f697e376f7b74808b2fb6f92dc7baafbba77895a08bdd)
- Pilot 4 · redemption · 13.1106 USDC · [0e4c5a074eb71bcf10f3f52cae313c064f5e6e223476b9a5d54092f00b750f41](https://stellar.expert/explorer/testnet/tx/0e4c5a074eb71bcf10f3f52cae313c064f5e6e223476b9a5d54092f00b750f41)
- Pilot 4 · redemption · 9.8329 USDC · [395ab4c274745131492fd66b944dccffbe121a1e67c3bc2e671091f497315623](https://stellar.expert/explorer/testnet/tx/395ab4c274745131492fd66b944dccffbe121a1e67c3bc2e671091f497315623)
