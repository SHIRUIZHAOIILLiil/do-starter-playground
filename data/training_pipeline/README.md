# Future reliability modelling (not implemented)

1. Collect live observations over time; exclude `mock` and distinguish `stale` data.
2. Establish actual outcomes and a defensible matching rule for journey / vehicle IDs.
   An arrival prediction is not a verified actual arrival. Line status is not a delay label.
   The three Phase 1 sources alone cannot train a validated journey-reliability model.
3. Define an initial historical baseline by mode, route, time of day and weekday.
   Report coverage and sample counts before comparing "now" with "normally".
4. Split train / validation / test chronologically and compute baselines using only past
   data. Keep future disruption updates and eventual outcomes out of input features.
5. Evaluate a simple baseline first, including missing-data coverage and uncertainty.
   Consider a neural model only after collecting enough reliable labelled journeys.

No model, route recommender, Green Wave, JamCam CV or 3D feature is part of Phase 1.
