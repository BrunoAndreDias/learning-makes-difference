# Free-Tier Answer Check Is Non-Authoritative And Non-LLM

Free-tier Answer Check uses deterministic scoring over Study Note answer-check reference material rather than LLM grading. It provides explainable guidance during FlashCard recall, while the User self-rating remains the source of recall evidence and `AiGraded` remains the premium path for authoritative AI-generated grading.

This keeps the core Learning Loop usable without AI or provider cost, and it makes the free-tier guidance inspectable through covered concepts, missing concepts, contradictions, accepted variants, and coarse confidence. The tradeoff is that Answer Check is intentionally conservative and less semantically capable than an LLM; when it cannot determine correctness, it should guide the User toward uncertainty rather than replacing their judgment.
