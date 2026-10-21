# Data preparation

Phase 1 normalizes live feeds in `apps/website/src/lib/tfl/`. There is no persistent
collector, database, training pipeline or trained model yet.

`collector/README.md` specifies the proposed append-only collection format;
`training_pipeline/README.md` specifies future labels and validation boundaries.
Runtime mock data is synthetic and must never be included in training data.
