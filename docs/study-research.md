# Study Research Map

This document organizes the learning-science research behind the product direction for Learning Makes Difference. It is a research map, not a product spec. Use it to explore study strategy, evaluate product ideas, and connect learning principles to app concepts such as Study Notes, RecallSessions, Labels, Learning State, Due for Recall, and FocusSessions.

## How To Use This Document

Use this document when you need to answer one of these questions:

- Which learning techniques have the strongest evidence?
- Which techniques should the app encourage by default?
- Which product features map to real learning mechanisms rather than study theater?
- What should be explored later before becoming a product requirement?
- Which researchers or evidence areas should be checked before making a hard decision?

This document intentionally separates:

- Research principles: what the learning-science literature suggests.
- Study practice: how a learner can apply the principle.
- Product implications: how the app might support the principle.
- Open questions: what still needs grilling before it becomes a requirement.

## Contents

- [Executive Summary](#executive-summary)
- [Evidence Strength Legend](#evidence-strength-legend)
- [Core Learning Model](#core-learning-model)
- [Evidence Map](#evidence-map)
- [Product Mapping](#product-mapping)
- [Technique Library](#technique-library)
- [Weak Techniques When Used Alone](#weak-techniques-when-used-alone)
- [Integrated Study Loops](#integrated-study-loops)
- [Study Recipes](#study-recipes)
- [Strongest Technique Combinations](#strongest-technique-combinations)
- [Weekly Learning System](#weekly-learning-system)
- [Oakley Mapped To The Research](#oakley-mapped-to-the-research)
- [Priority Hierarchy](#priority-hierarchy)
- [Future Exploration Questions](#future-exploration-questions)
- [Essential Bibliography](#essential-bibliography)

## Executive Summary

Barbara Oakley is a useful starting point because her books and the Learning How to Learn course translate cognitive science into practical advice: focused and diffuse thinking, chunking, retrieval, procrastination management, illusions of competence, and spaced practice.

Oakley should be treated mainly as a popularizer and integrator of learning science, alongside neuroscientist Terrence Sejnowski, rather than as the single primary source behind the strongest findings. The strongest evidence comes from cognitive psychology, educational psychology, cognitive load theory, expertise research, metacognition research, and motivation research.

The strongest practical evidence supports:

- Retrieval practice: trying to recall before looking.
- Distributed practice: spacing recall over time.
- Feedback: correcting errors quickly.
- Worked examples for beginners: learning from expert solutions before unguided practice.
- Self-explanation: explaining why steps and concepts work.
- Interleaving after basics: mixing related problem types to improve discrimination.
- Deliberate practice for skill: focused practice on specific weaknesses.
- Sleep, breaks, and exercise as support systems for attention and consolidation.

The highest-value product direction is not passive note storage. It is a Study Layer that helps the User transform source material into trainable Study Notes, retrieve them through RecallSessions, correct gaps, space future recall, and understand what needs practice.

## Evidence Strength Legend

| Label | Meaning | Product caution |
| --- | --- | --- |
| Very strong | Repeated support across many studies or reviews and broad practical value. | Safe to build into the core Learning Loop. |
| Strong | Good evidence, but value may depend on domain, learner level, or implementation. | Good feature candidate if the workflow stays simple. |
| Moderate | Plausible and useful, but effects are more variable or learner-dependent. | Support as optional or contextual behavior. |
| Mixed | Popular or partially supported, but often oversold. | Avoid making it central without a precise mechanism. |
| Weak alone | Can help as a small supporting tactic, but fails as the main study method. | Do not reward it as if it proves learning. |

## Core Learning Model

Learning is not one technique. It is a system that combines four processes.

| Process | Meaning | Failure mode |
| --- | --- | --- |
| Encoding | Building the first mental model. | Copying text without understanding. |
| Retrieval | Pulling knowledge from memory without looking. | Mistaking recognition for recall. |
| Transfer | Using knowledge in new contexts. | Knowing a procedure but not when to use it. |
| Regulation | Planning, monitoring, and correcting the learning process. | Studying more without adapting strategy. |

A useful formula:

```text
Understand lightly -> retrieve often -> correct quickly -> space over time -> vary the context -> apply in real tasks.
```

Dunlosky and colleagues' major review rated practice testing and distributed practice as especially high-utility techniques across many learning conditions. Techniques such as rereading and highlighting were much weaker when used alone.

## Evidence Map

| Category | Main techniques | Best for | Major names or studies | Evidence strength |
| --- | --- | --- | --- | --- |
| Memory and retention | Retrieval practice, spaced repetition, cumulative review | Remembering concepts, facts, and procedures | Roediger, Karpicke, Cepeda, Ebbinghaus, Dunlosky | Very strong |
| Understanding and meaning | Self-explanation, elaboration, analogies, concept maps, teaching others | Conceptual learning, theory, reading | Chi, Craik and Lockhart, Dunlosky, Mayer | Strong to moderate |
| Problem solving and skill | Worked examples, deliberate practice, feedback, error logs, fading guidance | Math, programming, engineering, exams, music, sport | Sweller, Renkl, Ericsson, Kalyuga | Strong, context-dependent |
| Transfer and discrimination | Interleaving, varied practice, mixed problem sets, contrasting examples | Knowing which method to use, not just how | Bjork, Rohrer, Kornell | Strong in many domains, but difficult for learners |
| Cognitive load management | Chunking, worked examples, clean materials, segmentation, dual coding | New or difficult topics | Sweller, Mayer, Paivio, Oakley | Strong |
| Metacognition and self-regulation | Planning, monitoring, calibration, reflection, learning journals | Independent learning and long projects | Zimmerman, Pintrich, Winne, EEF | Strong, but needs explicit training |
| Motivation and persistence | Autonomy, competence, relatedness, goal design, identity, feedback | Sustained learning | Deci, Ryan, Dweck, Bandura, Duckworth | Important, often oversimplified |
| Biological foundations | Sleep, exercise, stress management, breaks | Consolidation, attention, long-term performance | Rasch, Born, Singh, Walker | Strong as support system |

## Product Mapping

This section translates the research into product implications. It is not automatically a feature list.

| Research principle | App domain concept | Product implication | Current caution |
| --- | --- | --- | --- |
| Retrieval practice | RecallSession, Question, Study Note | The app should hide reference material first and require active recall before reveal. | Do not let recall degrade into rereading. |
| Spaced practice | Due for Recall, Recall Today | The app should help the User know what should be recalled now. | Scheduling rules need to remain explainable. |
| Feedback | Question, SessionResult, Learning State | The User should correct gaps after each attempt and see recall evidence later. | Historical Results must preserve snapshots. |
| Self-explanation | Study Note expected answer, source Note, Metaphor | The app can prompt the User to explain why, how, examples, and limits. | Avoid turning prompts into busywork. |
| Cognitive load | Study Notes Workspace, templates, worked examples | New material should be chunked into small trainable units. | Too much feature density can damage learning. |
| Interleaving | RecallSession builder, Label filters | Sessions can eventually mix related Study Notes to improve discrimination. | Use after basics, not as the first beginner experience. |
| Metacognition | Learning State, SessionResult review, reflection prompts | The app should expose what the User knows, does not know, and should do next. | Avoid false precision such as premature mastery percentages. |
| Deliberate practice | Needs practice, error logs, targeted sessions | The app should convert mistakes into future practice. | Needs practice should be derived from recall evidence. |
| Motivation | FocusSession, progress, Settings | Support autonomy, competence, and sustainable rhythm. | Motivation features cannot replace retrieval and feedback. |
| Biological support | FocusSession, breaks, weekly planning | Focus and breaks can support attention and consolidation. | Focus time is not the same as memory gained. |
| Memory aids | Metaphor, Acronym | Memory aids should support Study Notes and may later act as hints. | They should not automatically become recall targets in v1. |

## Technique Library

### A. Memory And Retention

#### Retrieval Practice

Retrieval practice means trying to recall information before looking at the answer. Examples include closed-book recall, flashcards, practice exams, explaining from memory, or writing everything remembered on a blank page.

The key idea is that tests are not only assessment tools. They are learning tools. Roediger and Karpicke's work on test-enhanced learning showed that taking memory tests improves long-term retention, especially compared with repeated studying when the final test is delayed.

How to use it:

- After reading or watching something, close the source.
- Answer from memory before checking.
- Compare against the source.
- Correct gaps immediately.
- Recall again later.

Useful retrieval prompts:

- What were the three main ideas?
- What problem does this solve?
- What are the steps?
- What would be an example?
- What would be a counterexample?
- Where might I use this?

For technical learning, retrieval should happen in three forms.

| Type | Question | Why it matters |
| --- | --- | --- |
| Concept retrieval | Can I define the idea from memory? | Builds durable concepts. |
| Procedural retrieval | Can I perform the steps without looking? | Builds executable skill. |
| Conditional retrieval | Can I decide when to use this method? | Builds judgment and transfer. |

Product implications:

- RecallSessions should keep answers hidden until the User attempts recall.
- Study Notes should have prompts and expected answers, not just source text.
- The product should make passive recognition visibly different from actual recall.

Open questions:

- Should typed answers be encouraged in FlashCard mode, or should mental recall remain enough?
- Should confidence before answer be optional, required, or deferred?
- How should the app distinguish skipped Study Notes from failed recall attempts?

#### Spaced Repetition And Distributed Practice

Spaced practice means reviewing material across time instead of massing it into one session. The spacing effect goes back to early memory work associated with Hermann Ebbinghaus and has been supported by later quantitative reviews. A major review by Cepeda and colleagues examined hundreds of assessments across many experiments and found robust benefits for distributed practice.

Spacing works best when combined with retrieval. Do not just reread the material later. Try to recall first, then check.

Practical spacing schedule:

| Moment | What to do |
| --- | --- |
| Same day | 5 to 10 minutes of active recall. |
| Next day | Recall again, then check gaps. |
| 3 to 4 days later | Practice questions or flashcards. |
| 1 week later | Mixed quiz. |
| 2 to 4 weeks later | Cumulative review. |
| Before exam or project | Full simulation under realistic conditions. |

Product implications:

- Due for Recall should be attached to Study Notes, not source Notes.
- Recall Today should prioritize Study Notes due now.
- The scheduling rule should be explainable enough that the User trusts it.

Open questions:

- Should the first scheduler use a deterministic interval ladder or a known algorithm such as SM-2?
- Should the User be able to manually override the next recall date?
- Should Needs practice and Due for Recall be separate surfaces or one prioritized queue?

#### Interleaving

Interleaving means mixing related problem types instead of practicing one type in a block.

Blocked practice:

```text
AAA BBB CCC
```

Interleaved practice:

```text
ABC BAC CAB
```

Interleaving is harder and often feels worse during practice, but it improves discrimination. The learner improves not only at solving a problem, but at recognizing which strategy is appropriate. Rohrer and Taylor's work on mathematics practice and Kornell and Bjork's work on category learning are classic examples.

Use interleaving after basic understanding exists. For complete beginners, too much interleaving too early can overload working memory.

Product implications:

- RecallSession builders can eventually mix related Labels or sibling concepts.
- Mixed sessions should explain why they feel harder.
- Beginner flows should not overuse interleaving before the User has stable chunks.

Open questions:

- When should the app start mixing Labels automatically?
- Should sibling Study Notes from the same source Note be separated inside a RecallSession?
- Should interleaving be a session mode, a scheduler behavior, or both?

#### Desirable Difficulties

Robert and Elizabeth Bjork's concept of desirable difficulties explains why effective learning often feels slower, harder, and less fluent than ineffective learning. Spacing, retrieval, interleaving, and varied practice can reduce short-term performance while improving long-term retention and transfer.

The word desirable matters. Not all difficulty is good. Difficulty helps when it forces useful processing. It hurts when the learner lacks the background to make progress.

Product implications:

- The product should normalize productive effort without making the interface punishing.
- Recall feedback should distinguish useful struggle from being stuck.
- Learning State should use clear evidence-based copy, not shame labels.

Open questions:

- How should the app explain why a harder mixed session was recommended?
- Should the app protect beginners from too much difficulty too early?

### B. Understanding And Deep Processing

#### Self-Explanation

Self-explanation means explaining why each step, concept, or solution makes sense. Michelene Chi's classic work found that stronger learners generated more explanations while studying worked examples, connecting solution steps to underlying principles. Later meta-analytic work also supports self-explanation prompts as useful across many conditions.

Useful prompts:

- Why does this step follow?
- What principle is being used?
- What would break if this assumption changed?
- How is this different from the previous example?
- What mistake would a beginner make here?

Self-explanation is one of the best bridges between memory and understanding.

Product implications:

- Study Note templates can ask for why, mechanism, example, non-example, and limits.
- Expected answers should support explanation, not just short definitions.
- SessionResult review can prompt the User to repair weak explanations.

Open questions:

- Should self-explanation prompts be templates or inline suggestions?
- Should every Study Note include expected answer, source context, and optional explanation fields, or is that too much structure?

#### Elaborative Interrogation

Elaborative interrogation means asking why and how questions about facts or concepts.

Instead of memorizing:

```text
HTTP is stateless.
```

Ask:

- Why is HTTP stateless?
- What problems does that create?
- How do cookies, sessions, or tokens solve those problems?
- What would a stateful alternative look like?

Elaboration works because it links new knowledge to prior knowledge, making memory more meaningful and flexible. Dunlosky's review rated elaborative interrogation as useful, though not as universally powerful as retrieval and spacing.

Product implications:

- Study Note creation can suggest why/how variants of a prompt.
- Metaphors can be used as elaboration, but should not replace direct recall.
- Labels can help connect related concepts for elaboration.

Open questions:

- Should the app suggest elaboration prompts automatically after a weak recall attempt?
- Should AI eventually generate why/how follow-up questions?

#### Dual Coding And Multimedia Learning

Dual coding means combining words with meaningful visuals: diagrams, timelines, flowcharts, equations, architecture sketches, memory palaces, or annotated examples. Richard Mayer's cognitive theory of multimedia learning argues that people learn from words and pictures through limited-capacity verbal and visual channels, so well-designed visuals can support understanding.

Good dual coding is not decoration. A useful visual shows structure.

| Structure | Example visual |
| --- | --- |
| Cause -> effect | Causal chain. |
| Input -> process -> output | System flow. |
| Concept -> example -> non-example | Concept discrimination map. |
| Problem -> strategy -> solution | Worked solution map. |
| Component -> interaction -> failure mode | Architecture diagram. |

Avoid cluttered diagrams. Visuals should reduce cognitive load, not increase it.

Product implications:

- Source Notes may eventually support diagrams or attachments.
- The app can encourage redraw-from-memory as a retrieval activity.
- Visual prompts should map to Study Notes when they test recall.

Open questions:

- Are diagrams part of Notes, Study Notes, or both?
- Should visual recall be supported before AI features?

#### Teaching Others And Feynman-Style Explanation

Teaching others is powerful when it forces retrieval and self-explanation. It is less powerful if it becomes performance or vague summarizing.

A strong teaching test:

- Explain the idea in simple language.
- Give a concrete example.
- Give a non-example.
- Solve a problem using it.
- Explain the most common misconception.
- Answer a question you did not prepare for.

This turns "I recognize it" into "I can use it."

Product implications:

- A Study Note can include prompts that ask for simple explanation, examples, and misconceptions.
- RecallSession modes can eventually include explain-to-someone style questions.
- SessionResult review can reveal whether the User only recognized the answer or could explain it.

Open questions:

- Should teaching-style prompts be a template?
- Should the app support sharing or peer review, or keep social learning out of scope for now?

### C. Problem Solving And Skill Acquisition

#### Worked Examples

For beginners, studying solved examples is often more efficient than immediately solving many problems alone. John Sweller's cognitive load theory argues that unguided problem solving can consume working memory that should be used to build schemas.

Worked-example research, including reviews by Atkinson, Renkl, and colleagues, supports expert solutions as instructional tools, especially when learners are new to a domain.

A good worked-example routine:

1. Read the problem.
2. Predict the first step.
3. Study the expert step.
4. Explain why that step works.
5. Cover the next step and predict it.
6. Compare.
7. Solve a near-identical problem.
8. Solve a slightly different one.
9. Add the mistake to an error log.

This integrates worked examples, retrieval, self-explanation, and feedback.

Product implications:

- The app should not force beginners into unguided recall before they have a first model.
- Source Notes can contain worked examples while Study Notes target the trainable unit.
- Templates can support "predict next step" and "why this step" prompts.

Open questions:

- Should worked examples be a source Note pattern or a Study Note template?
- Should the app have beginner, intermediate, and advanced guidance levels?

#### Fading Guidance

As skill grows, guidance should fade.

```text
Fully worked examples -> partially completed examples -> independent problems -> mixed problems -> real projects.
```

This matters because the best technique changes with expertise. The expertise reversal effect shows that highly guided materials can help novices but become redundant or even unhelpful for more advanced learners.

The right question is not:

```text
Should I use examples or solve problems?
```

The right question is:

```text
How much guidance do I need at this stage?
```

Product implications:

- Study flows should support progression from examples to independent recall.
- A future Learning State could inform how much support to show.
- Hints should be treated as scaffolding, not failure by default.

Open questions:

- Should hint usage affect Learning State directly or only act as evidence?
- Should guidance level be automatic, manual, or inferred from performance?

#### Deliberate Practice

K. Anders Ericsson's work on expert performance emphasizes practice that is focused, effortful, feedback-rich, and designed to improve specific weaknesses. Deliberate practice is not just repetition. It requires clear goals, immediate feedback, correction, and repeated refinement.

Useful deliberate-practice template:

| Step | Question |
| --- | --- |
| Target | What exact subskill am I improving? |
| Challenge | Is this just beyond my comfort zone? |
| Feedback | How will I know if I am wrong? |
| Correction | What will I change next attempt? |
| Repetition | How many focused attempts will I do? |
| Reflection | What pattern of mistakes is emerging? |

Important nuance: deliberate practice matters, but it is not the whole story. A meta-analysis by Macnamara, Hambrick, and Oswald found that deliberate practice explains different amounts of performance variance depending on the domain. It is important, but not a magic single-factor explanation for expertise.

Product implications:

- Needs practice should identify specific Study Notes or Labels, not vague weakness.
- Error-driven practice should become a future session builder candidate.
- FocusSessions can support deliberate practice time blocks, but Focus time alone is not evidence of learning.

Open questions:

- Should the app support explicit practice targets inside FocusSessions?
- Should repeated mistakes create suggested Study Notes, Labels, or practice queues?

#### Error Logs

An error log converts mistakes into a curriculum.

For every mistake, write:

| Field | Example |
| --- | --- |
| Error | I used the wrong formula, API, theorem, or strategy. |
| Type | Conceptual, procedural, attention, memory, interpretation. |
| Cause | I recognized surface features, not deep structure. |
| Correction | Next time I will check X before choosing method Y. |
| New practice item | Create 3 similar-but-different problems. |

Product implications:

- SessionResult review can eventually support error classification.
- Needs practice can be improved by grouping repeated error types.
- Error logs could become the bridge between recall history and future practice planning.

Open questions:

- Should error logs be first-class objects, metadata on Questions, or just reflection text?
- Should the app classify errors manually, with AI, or not at all in v1?

### D. Cognitive Load And Attention

#### Cognitive Load Theory

Working memory is limited. Learning materials should reduce unnecessary load and focus effort on schema building. Sweller's work is foundational here, especially for complex problem solving.

Three practical rules:

| Rule | Meaning |
| --- | --- |
| Reduce extraneous load | Remove clutter, distractions, and unclear instructions. |
| Manage intrinsic load | Break complex material into chunks. |
| Increase germane load | Use effort for explanation, retrieval, and schema building. |

This is why a beginner often needs clean explanations, examples, and small steps before heavy interleaving or open-ended projects.

Product implications:

- The app should make the primary action obvious: create Study Notes, recall, correct, repeat.
- Editor surfaces should avoid making Users manage too many fields at once.
- Templates should reduce setup friction without hiding the learning mechanism.

Open questions:

- Does the Study Notes Workspace currently reduce or increase cognitive load?
- Which fields should be advanced, optional, or hidden until needed?

#### Chunking

Oakley often emphasizes chunking: compressing many details into one meaningful unit. A chess player sees patterns, not isolated pieces. A programmer sees an authentication flow, not disconnected lines of code. A mathematician sees a proof structure, not random symbols.

Chunking is built through:

- Examples.
- Retrieval.
- Pattern comparison.
- Self-explanation.
- Feedback.
- Repeated use in varied contexts.

A chunk is not created by rereading. It is created by use.

Product implications:

- Study Notes should be atomic enough to train, but not so tiny that they lose meaning.
- Source Notes can hold cohesive context behind several sibling Study Notes.
- The app should help Users split broad material into usable Study Notes.

Open questions:

- What UI signals tell a User that a Study Note is too broad?
- Should AI eventually suggest splitting source Notes into multiple Study Notes?

#### Focused And Diffuse Modes

Oakley's focused mode and diffuse mode are useful as a practical metaphor. Focused mode is deliberate concentration. Diffuse mode is relaxed background processing that can help with insight after effort. Her course explicitly teaches these two modes, chunking, procrastination, memory techniques, and research-backed practices.

Practical cycle:

```text
25 to 50 minutes focused work
5 to 10 minutes break
return and retrieve from memory
after several cycles, take a longer break
sleep on hard problems
restart by recalling, not rereading
```

The key is not the exact timer length. The key is alternating deep focus, recovery, and retrieval.

Product implications:

- FocusSessions support attention, not memory by themselves.
- BreakIntervals should be treated as real recovery, not idle failure.
- Post-Focus prompts can encourage recall or Study Note creation without forcing it.

Open questions:

- Should FocusSessions recommend Needs practice material before or after a session?
- Should post-Focus reflection create recall evidence only when it uses a RecallSession?

### E. Metacognition And Self-Regulated Learning

Metacognition means knowing how well you know something. Self-regulated learning means planning, monitoring, and adjusting learning.

Zimmerman and Pintrich are central names here, and modern reviews describe several major self-regulated learning models. The Education Endowment Foundation also summarizes evidence-based classroom recommendations for metacognition and self-regulation.

A self-regulated learner repeatedly asks:

| Moment | Questions |
| --- | --- |
| Before learning | What is the goal? What do I already know? What strategy will I use? |
| During learning | Am I understanding, or only recognizing? Can I recall without looking? |
| After learning | What did I get wrong? What should I review? What should I practice next? |

The biggest metacognitive danger is fluency illusion: when rereading, watching, or highlighting feels like learning because the material feels familiar. Retrieval practice is the antidote.

Product implications:

- Learning State should expose recall facts, not vague judgments.
- SessionResults should help Users inspect what happened and decide what to do next.
- Weekly planning can connect FocusRecords, SessionResults, Due for Recall, and Needs practice.

Open questions:

- Should the app support weekly learning reviews?
- Which calibration signals are useful without creating false precision?
- Should confidence prompts exist before answer reveal?

### F. Motivation, Identity, And Persistence

#### Self-Determination Theory

Ryan and Deci's self-determination theory argues that motivation improves when three psychological needs are supported.

| Need | Meaning | Product implication |
| --- | --- | --- |
| Autonomy | I have meaningful choice. | Let Users choose what to study while showing evidence-based recommendations. |
| Competence | I can see progress. | Show specific recall facts and completed work. |
| Relatedness | I feel connected to people, purpose, or community. | Connect study work to goals, exams, projects, or future social features. |

Practical applications:

- Choose projects that matter.
- Track visible progress.
- Work with peers or mentors.
- Make the next step achievable.
- Connect drills to real goals.

Product implications:

- Recommendations should explain why without removing User choice.
- Progress should be based on recall evidence, not only time spent.
- Study Objective and Study Intensity should remain profile context unless they change real behavior.

Open questions:

- How should the app balance recommended study with User autonomy?
- Should Study Objective eventually affect session recommendations?

#### Growth Mindset

Carol Dweck's growth mindset idea is influential: abilities can develop through effort, strategy, feedback, and persistence. But the evidence for mindset interventions is mixed. Sisk and colleagues found weak overall relationships between mindset and academic achievement, and more recent critiques argue that some intervention effects may be smaller or more conditional than popular accounts suggest.

The practical version:

```text
Do not just tell yourself "I can improve."
Ask: "What strategy, feedback, and practice will produce improvement?"
```

Growth mindset is helpful when it leads to better behavior. It is not a substitute for retrieval, feedback, spacing, or deliberate practice.

Product implications:

- Avoid motivational copy that hides weak study mechanics.
- Encourage strategy changes after evidence of poor recall.
- Use supportive copy such as Needs practice rather than shame labels.

Open questions:

- What tone should the product use when the User repeatedly struggles?
- Should the app recommend strategy changes, not just more recall?

### G. Active Learning And Social Learning

Active learning means learners do something cognitively demanding: solve, explain, predict, debate, retrieve, apply, or critique.

A large PNAS meta-analysis by Freeman and colleagues found that active learning improved performance in undergraduate STEM courses compared with traditional lecturing.

Examples:

- Peer instruction.
- Think-pair-share.
- Practice questions during lectures.
- Case studies.
- Problem-based learning.
- Debugging sessions.
- Socratic questioning.
- Group explanation.
- Code reviews.
- Design critiques.

The core mechanism is not group work. The core mechanism is active cognitive engagement plus feedback.

Product implications:

- The app should make Study Notes active prompts, not just stored notes.
- Social learning is optional; the core loop can remain single-player if it preserves active engagement.
- Code review, critique, and debugging could become domain-specific Study Note templates.

Open questions:

- Should social learning ever be in scope?
- Which active-learning patterns can be represented without turning the app into a classroom tool?

### H. Biological Foundations

#### Sleep

Sleep supports memory consolidation. Rasch and Born's review summarizes more than a century of work showing that sleep benefits memory retention and consolidation.

Practical rules:

- Do not sacrifice sleep to gain low-quality study time.
- A tired brain may produce more hours but less learning.
- Study difficult material earlier when possible.
- Do retrieval before bed.
- Review briefly the next day.
- Avoid all-nighters except in emergencies.

Product implications:

- The product should not glorify streaks or excessive study duration.
- Scheduling should respect sustainable study rhythms.
- User Time Zone matters for due dates and daily grouping.

Open questions:

- Should the app avoid pushing late-night recall recommendations?
- Should Focus analytics surface rest-friendly patterns or stay neutral?

#### Exercise

Exercise supports cognition, memory, mood, and executive function. A 2025 umbrella review and meta-meta-analysis in the British Journal of Sports Medicine found evidence that exercise benefits general cognition, memory, and executive function across populations.

Practical integration:

- Use walks after hard study blocks.
- Exercise before demanding learning if it improves alertness.
- Use movement breaks to avoid mental fatigue.
- Treat exercise as part of the learning infrastructure, not separate from it.

Product implications:

- Break copy can encourage real recovery rather than screen switching.
- FocusSessions can support movement breaks without tracking health data.

Open questions:

- Should Focus break guidance mention movement, or would that overreach the product scope?

## Weak Techniques When Used Alone

### Rereading

Rereading feels productive because it increases familiarity. Familiarity is not the same as recall or transfer. Use rereading only after trying to retrieve.

Better loop:

```text
Read -> close source -> recall -> check -> correct -> practice.
```

Product caution:

- Do not reward opening or viewing Notes as if it were strong learning evidence.
- Note review can count as Focus activity only under narrow rules, but it should not count as recall evidence.

### Highlighting

Highlighting can help mark structure, but it often becomes passive. Dunlosky's review rated highlighting and underlining as relatively low utility when used as a main strategy.

Better use:

- Highlight only after identifying the argument.
- Convert highlights into questions.
- Turn questions into retrieval prompts.

Product caution:

- If highlights are ever supported, they should feed Study Note creation rather than become the main study activity.

### Summarizing

Summarizing can help advanced learners, but beginners often summarize badly because they cannot yet identify what matters.

Better structured summary prompts:

- What is the problem?
- What is the principle?
- What is the mechanism?
- What is an example?
- What are the limits?
- What question can test this?

Product caution:

- Summaries should not replace prompts and expected answers.
- A summary can be source Note material, but the trainable object remains the Study Note.

### Learning Styles

The idea that learners should be taught according to fixed visual, auditory, or kinesthetic learning styles is not well supported. Pashler, McDaniel, Rohrer, and Bjork reviewed the evidence and found that the type of evidence needed to justify learning-style-based instruction was lacking.

Better rule:

```text
Match the representation to the content.
```

Examples:

- Use diagrams for systems.
- Use audio for pronunciation.
- Use worked examples for procedures.
- Use simulations for dynamics.
- Use retrieval for memory.

Product caution:

- Do not create fixed learner-type profiles.
- User preferences can exist, but they should not override content-appropriate representations.

## Integrated Study Loops

### Universal Learning Loop

Use this loop for almost any subject.

1. Preview.
2. Learn with low cognitive load.
3. Self-explain.
4. Retrieve.
5. Practice.
6. Get feedback.
7. Space.
8. Interleave and vary.
9. Reflect.

| Step | Questions | Goal |
| --- | --- | --- |
| Preview | What is this about? What problem does it solve? What do I already know? What are the key terms? | Create mental hooks. |
| Learn with low cognitive load | What is the simplest clear explanation? What example shows the pattern? | Build the first mental model. |
| Self-explain | Why does each step or idea work? | Connect facts to principles. |
| Retrieve | Can I recall without looking? | Strengthen memory and reveal gaps. |
| Practice | Can I answer questions, solve problems, or apply the idea? | Turn knowledge into skill. |
| Get feedback | What was wrong, missing, or imprecise? | Correct errors before they fossilize. |
| Space | Can I recall later? | Fight forgetting. |
| Interleave and vary | Can I choose the right strategy in a mixed context? | Improve transfer and judgment. |
| Reflect | What should I change next? | Become self-regulated. |

### Learner Level Guidance

| Level | Main risk | Use | Avoid | Best mix |
| --- | --- | --- | --- | --- |
| Beginner | Overload | Worked examples, clear explanations, dual coding, short retrieval, immediate feedback, small exercises. | Too much interleaving, huge projects with no guidance, testing only at the end. | 50% examples, 25% guided practice, 15% retrieval, 10% reflection. |
| Intermediate | Fluency illusion | Retrieval practice, spaced repetition, mixed problem sets, self-explanation, error logs, partial worked examples. | Only rereading or repeating familiar exercises. | 25% review, 35% practice, 20% interleaving, 10% feedback, 10% reflection. |
| Advanced | Plateau | Deliberate practice, hard feedback, real projects, simulation, teaching, transfer challenges, constraint-based practice. | Comfortable repetition with no feedback. | 60% targeted practice, 20% feedback, 10% theory refinement, 10% reflection. |

## Study Recipes

### Recipe 1: Learning From A Book Or Article

Steps:

1. Preview headings and diagrams.
2. Turn headings into questions.
3. Read one section.
4. Close the book.
5. Write what you remember.
6. Check.
7. Create 3 to 5 retrieval questions.
8. Explain one idea in plain language.
9. Review questions tomorrow, then next week.

Best techniques used:

- Retrieval.
- Spacing.
- Elaboration.
- Self-explanation.
- Metacognition.

App mapping:

- Source Note: section explanation and useful examples.
- Study Notes: 3 to 5 retrieval prompts with expected answers.
- RecallSession: tomorrow and next week.
- Labels: topic or study area.

### Recipe 2: Learning Mathematics, Algorithms, Or Engineering

Steps:

1. Study one worked example.
2. Explain each step.
3. Cover the solution and reproduce it.
4. Solve a near-transfer problem.
5. Solve a far-transfer problem.
6. Add mistakes to an error log.
7. Mix this problem type with older ones.
8. Review after 1, 3, 7, and 14 days.

Best techniques used:

- Worked examples.
- Fading guidance.
- Retrieval.
- Interleaving.
- Deliberate practice.

App mapping:

- Source Note: worked example and solution explanation.
- Study Notes: step predictions, concept questions, and method-selection prompts.
- RecallSession: mix with older related Study Notes.
- Future feature candidate: error log or mistake classification.

### Recipe 3: Learning Programming Or Software Engineering

Steps:

1. Read the concept, such as caching, indexing, OAuth, or concurrency.
2. Draw the mechanism.
3. Explain it without notes.
4. Implement a minimal version.
5. Break it intentionally.
6. Debug from memory before searching.
7. Compare with a high-quality implementation.
8. Write an error log.
9. Rebuild it later without looking.
10. Use it in a small project.

Best techniques used:

- Dual coding.
- Retrieval.
- Deliberate practice.
- Feedback.
- Transfer.

App mapping:

- Source Note: mechanism, diagram, implementation notes, failure modes.
- Study Notes: why/how prompts, debugging prompts, examples, non-examples.
- FocusSession: implementation block.
- RecallSession: later closed-book explanation and method-selection questions.

### Recipe 4: Learning For Exams

Steps:

1. Collect exam-style questions early.
2. Study in short blocks.
3. After each block, do closed-book recall.
4. Use spaced review.
5. Build mixed practice sets.
6. Simulate exam conditions.
7. Mark errors by type.
8. Re-practice weak categories.
9. Sleep properly before the final review.

Best techniques used:

- Retrieval.
- Spacing.
- Interleaving.
- Feedback.
- Sleep.

App mapping:

- Labels: exam topics or study areas.
- Study Notes: exam-style prompts and expected answers.
- Due for Recall: scheduled practice.
- Needs practice: low-performing Study Notes.
- Future feature candidate: exam metadata and session builder.

### Recipe 5: Learning A Language

Steps:

1. Use spaced repetition for vocabulary.
2. Retrieve words actively, not just recognize them.
3. Practice production: speaking and writing.
4. Interleave grammar patterns.
5. Use comprehensible input.
6. Shadow pronunciation.
7. Get corrective feedback.
8. Use real conversations.
9. Review mistakes.

Best techniques used:

- Spacing.
- Retrieval.
- Varied practice.
- Feedback.
- Active use.

App mapping:

- Study Notes: production prompts, vocabulary in context, grammar contrasts.
- RecallSession: active production, not only recognition.
- Labels: topic, grammar pattern, conversation domain.
- Future feature candidate: answer feedback or pronunciation-adjacent support if product scope expands.

## Strongest Technique Combinations

### Retrieval + Spacing

This is probably the highest-value combination for long-term retention.

Use it for:

- Facts.
- Definitions.
- Formulas.
- Commands.
- Concepts.
- Vocabulary.
- Diagrams.

Method:

1. Recall today.
2. Recall tomorrow.
3. Recall next week.
4. Recall in mixed context later.

### Worked Examples + Self-Explanation

Best for new technical material.

Method:

1. Study an example.
2. Explain every step.
3. Predict missing steps.
4. Solve a similar problem.
5. Gradually remove support.

### Interleaving + Error Log

Best for exams and real-world problem solving.

Method:

1. Mix problem types.
2. Notice wrong choices.
3. Classify errors.
4. Create new practice based on error patterns.

### Dual Coding + Retrieval

Best for systems, architecture, science, history, and complex concepts.

Method:

1. Draw the system.
2. Hide the diagram.
3. Redraw from memory.
4. Explain each connection.
5. Compare with the original.

### Deliberate Practice + Feedback

Best for high-level performance.

Method:

1. Pick one subskill.
2. Practice at the edge of ability.
3. Get feedback.
4. Repeat with correction.
5. Track improvement.

### Metacognition + Weekly Planning

Best for long-term independent learning.

Weekly questions:

- What did I learn?
- What can I retrieve without notes?
- What did I misunderstand?
- What mistakes repeated?
- What should I stop doing?
- What is next week's highest-leverage practice?

## Weekly Learning System

### Daily Session, 60 Minutes

| Time | Activity |
| --- | --- |
| 5 min | Recall previous material. |
| 15 min | Learn new material with examples. |
| 10 min | Self-explain or draw. |
| 20 min | Practice, answer questions, or implement. |
| 5 min | Check answers and feedback. |
| 5 min | Write error log and schedule review. |

### Weekly Structure

| Day | Focus |
| --- | --- |
| Monday | New concept plus worked examples. |
| Tuesday | Retrieval plus guided practice. |
| Wednesday | New concept plus comparison. |
| Thursday | Mixed practice. |
| Friday | Error-log repair. |
| Saturday | Real project or exam simulation. |
| Sunday | Light spaced review plus planning. |

This system integrates Oakley-style practical learning with the strongest research-backed mechanisms.

## Oakley Mapped To The Research

| Oakley idea | Research connection | Practical use | Product mapping |
| --- | --- | --- | --- |
| Focused mode | Attention, working memory, deliberate practice | Deep work blocks | FocusSession and FocusInterval. |
| Diffuse mode | Incubation, rest, background processing | Breaks, walks, sleep | BreakInterval and sustainable pacing. |
| Chunking | Schema acquisition, cognitive load theory | Build reusable mental patterns | Atomic Study Notes with cohesive source Notes. |
| Illusions of competence | Metacognition, retrieval research | Test yourself before looking | RecallSession answer reveal and Learning State. |
| Procrastination control | Self-regulation, habit design | Start with small focused sessions | Focus setup and lightweight start. |
| Practice and repetition | Retrieval, spacing, deliberate practice | Review over time | Due for Recall and Recall Today. |
| Interleaving | Desirable difficulties | Mix problem types | Mixed RecallSession builder candidate. |
| Metaphor and analogy | Elaboration, transfer | Explain abstract ideas concretely | Metaphor as Study Note support material. |

Oakley is especially strong as a practical bridge. She packages research into habits learners can actually use. The scientific backbone comes from the broader research tradition: Bjork, Roediger, Karpicke, Dunlosky, Cepeda, Sweller, Chi, Mayer, Ericsson, Zimmerman, Ryan, Deci, and others.

## Priority Hierarchy

### Highest Priority

These should shape the core product experience.

- Retrieval practice.
- Spaced repetition.
- Feedback.
- Worked examples for beginners.
- Deliberate practice for skill.
- Self-explanation.
- Interleaving after basics.
- Sleep and sustainable recovery.

### Medium Priority

These should be supported where they reduce friction or improve understanding.

- Dual coding.
- Elaboration.
- Summarization with structure.
- Mnemonics.
- Group learning.
- Pomodoro-style time blocks.
- Concept maps.

### Low Priority When Used Alone

These should not be treated as proof of learning.

- Rereading.
- Highlighting.
- Passive videos.
- Copying notes.
- Beautiful notes without recall.
- Learning-style matching.
- Cramming.

## Future Exploration Questions

Use these questions to continue the research without turning every idea into a feature prematurely.

### Core Learning Loop

- What is the minimum Study Note structure that supports recall, correction, and spacing without overloading the User?
- How should the app help Users split broad source Notes into trainable Study Notes?
- Should Study Notes remain untyped, or should templates introduce type-like behavior without changing the domain model?

### Recall And Scheduling

- What first scheduler is explainable enough for v1?
- Should Due for Recall be based only on latest recall evidence, or should it consider streaks, lapses, and interval length?
- Should confidence-before-answer become part of RecallSessions?
- Should hint usage affect scheduling directly, or remain supporting evidence?
- Should Recall Today include only due Study Notes at first, or also include Needs practice material?

### Feedback And Error Repair

- Should error logs become a first-class product concept?
- Should Users classify mistakes manually after recall?
- How can SessionResults help Users create new practice rather than only review history?
- When does a repeated mistake suggest a new Study Note, a better expected answer, a Metaphor, or a split source Note?

### Labels And Progress

- Should Label progress include only directly assigned Study Notes or descendant Labels too?
- Should Label analytics use counts first: Due for Recall, Needs practice, Not recalled yet?
- Is a mastery percentage ever justified, and what exact rule would make it explainable?
- Should exam behavior be Label metadata first or a separate Exam concept later?

### Focus Integration

- Should Focus recommend Needs practice material before starting, after ending, or both?
- Should post-Focus reflection create recall evidence only when it enters a real RecallSession?
- How should the product keep Focus from becoming a second dashboard?
- What Focus analytics are useful without implying that time spent equals learning gained?

### Memory Aids

- Should Metaphors and Acronyms become hints inside RecallSessions?
- Should memory aids have user ratings, or is that unnecessary until hints exist?
- Should AI generate memory aids only as editable suggestions?
- What signals show that a Study Note is too broad because it needs too many memory aids?

### AI

- Which AI features reduce friction without weakening the core manual Learning Loop?
- Should AI generate Questions, suggest Study Notes, suggest Labels, grade answers, or generate memory aids first?
- What must the User accept before AI output becomes Persistent Study Data?
- How should BYOK privacy and key persistence be handled when AiAssisted or AiGraded modes are in scope?

## Essential Bibliography

Use this as a starting bibliography for future verification, deeper research, or product decision records.

| Area | References or names | Why it matters |
| --- | --- | --- |
| Study techniques review | Dunlosky, Rawson, Marsh, Nathan, and Willingham | Compares common learning techniques and rates utility. |
| Retrieval practice | Roediger and Karpicke | Test-enhanced learning and long-term retention. |
| Distributed practice | Cepeda, Pashler, Vul, Wixted, and Rohrer | Spacing effect across many studies. |
| Desirable difficulties | Bjork and Bjork | Explains why harder practice can improve long-term learning. |
| Interleaving | Rohrer and Taylor; Kornell and Bjork | Mixed practice and discrimination learning. |
| Cognitive load | Sweller | Working memory limits, schema building, and instructional design. |
| Worked examples | Atkinson, Derry, Renkl, and Wortham | Solved examples and guidance for novices. |
| Self-explanation | Chi | Explaining steps and principles while learning. |
| Multimedia learning | Mayer | Words, pictures, and limited-capacity learning channels. |
| Self-regulated learning | Zimmerman, Pintrich, Panadero, Winne, EEF | Planning, monitoring, reflection, and metacognition. |
| Motivation | Ryan and Deci | Self-determination theory: autonomy, competence, relatedness. |
| Growth mindset | Dweck; Sisk and colleagues | Useful but often oversold; strategy and feedback matter. |
| Deliberate practice | Ericsson; Macnamara, Hambrick, and Oswald | Expert performance and limits of deliberate-practice claims. |
| Sleep and memory | Rasch and Born | Sleep, consolidation, and retention. |
| Practical synthesis | Oakley and Sejnowski | Learning How to Learn and practical study habits. |

## Notes For Future Updates

When updating this document:

- Keep research claims separate from product decisions.
- Prefer concrete mechanisms over broad motivational claims.
- Add citations or links when moving from research notes to ADRs or product requirements.
- Preserve the distinction between Study Notes as recall targets and Notes as source material.
- Treat Focus time, passive review, and highlighting as support signals, not proof of learning.
