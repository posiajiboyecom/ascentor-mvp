// ─────────────────────────────────────────────────────────────────────────────
// Ascentor Knowledge Base Seeder
// Run: npx ts-node --project tsconfig.json scripts/seed-knowledge.ts
// Or:  npx tsx scripts/seed-knowledge.ts
//
// Seeds Pinecone with structured knowledge aligned to Ascentor's current focus:
//   - The core problem: talent without access to guidance
//   - The 90-day leadership framework (what Sage uses)
//   - Promotion mechanics (visibility, positioning, timing)
//   - Salary negotiation
//   - Career stage frameworks (Explorer / Builder / Climber)
//   - GROW coaching methodology (what Sage runs on)
//   - Decision-making under career uncertainty
//   - Stakeholder management
//   - Peer community and accountability
//   - Common professional challenges Sage users bring
// ─────────────────────────────────────────────────────────────────────────────

import { addChunks, KnowledgeChunk } from '../app/lib/rag';

// ── NAMESPACE MAP ─────────────────────────────────────────────────────────────
// framework   — core models and methodologies Sage uses
// promotion   — getting promoted, visibility, positioning
// salary      — negotiation scripts, timing, anchoring
// leadership  — leadership skills, executive presence, influence
// career      — career transitions, stage navigation, decisions
// coaching    — how Sage coaches, what good sessions look like
// community   — peer cohorts, accountability, belonging

const KNOWLEDGE: { namespace: string; chunks: KnowledgeChunk[] }[] = [

  // ══════════════════════════════════════════════════════════════════════════
  // NAMESPACE: framework
  // The core models Sage is built on
  // ══════════════════════════════════════════════════════════════════════════
  {
    namespace: 'framework',
    chunks: [
      {
        id: 'grow-model-001',
        text: `The GROW model is the coaching framework Sage uses in every session. GROW stands for Goal, Reality, Options, Will.

Goal: What does the person want to achieve? Not a vague aspiration — a specific, time-bound outcome. "I want to be seen as ready for promotion to Senior Manager by my director within 90 days" is a Goal. "I want to be more senior" is not.

Reality: What is actually happening right now? This is the hardest part. Most people describe the situation as they wish it were, not as it is. Good coaching questions here: "What evidence do you have for that?" "What would someone else observing this situation notice?" "What have you already tried?"

Options: What could the person do? Generate as many options as possible before evaluating any. The coaching trap is jumping to solutions. Options phase is expansive — list 5-10 before choosing.

Will: What will the person actually do? Specific, committed action with a deadline. Not "I'll think about it" — "I will send the email to my manager by Thursday."

Sage uses GROW implicitly — it does not announce "we are now in the Reality phase." The structure shapes the questions without the user needing to know the framework.`,
        metadata: { category: 'framework', source: 'GROW model', tags: ['coaching', 'methodology', 'sage'] },
      },
      {
        id: '90day-framework-001',
        text: `The 90-Day Leadership Framework is the structure behind Ascentor's core product. It is what Sage runs every coaching relationship on.

The framework has three phases:

Phase 1 — Weeks 1-2: Foundation. Set one specific, observable 90-day goal. Map stakeholders — every person whose opinion matters for this goal. Identify the three most likely obstacles. Have the first visibility conversation with your manager: "What would make you confident recommending me for [X] by [date]?"

Phase 2 — Weeks 3-10: Execution. One primary action per week. The actions are not arbitrary — each one addresses a specific lever: visibility, lateral connection, demonstrated leadership capability, or direct manager alignment. Weekly check-in question to assess whether you're working on the right thing or drifting into busy work.

Phase 3 — Weeks 11-13: Complete and capture. Deliver the most important output. Follow up in writing. Complete the 90-day review — what changed, what you learned, what comes next.

The review is mandatory. Professionals who reflect deliberately after each 90-day cycle compound their learning. Those who skip it repeat the same patterns.

The next 90-day goal should be set on Day 90 of the previous cycle.`,
        metadata: { category: 'framework', source: '90-day playbook', tags: ['90-day', 'leadership', 'framework'] },
      },
      {
        id: 'three-decisions-001',
        text: `Every meaningful career outcome flows from three categories of decision. Professionals who understand and manage all three advance faster than those who only optimise for one.

1. Visibility decisions — Who knows what you are capable of? Not just your manager, but your manager's manager, cross-functional peers, and senior stakeholders. Visibility is not self-promotion. It is making your work legible to the people who make decisions about your future. The most common failure: talented people who work quietly, deliver excellently, and are consistently surprised when less talented peers advance past them.

2. Timing decisions — When do you push and when do you wait? When do you ask for the promotion? When do you have the difficult conversation? When do you leave? Timing requires reading the situation accurately — not just validating what you already want to do. This is where a thinking partner is most valuable.

3. Positioning decisions — How do you describe yourself and your work? Are you positioning as the person they need in two years, or the person they have now? Your positioning determines which opportunities find you. Most professionals let their positioning be defined by others rather than actively shaping it.

The most useful question across all three: "If I were advising someone else in this exact situation, what would I tell them to do?" This creates the distance needed to think clearly.`,
        metadata: { category: 'framework', source: 'Ascentor core thesis', tags: ['visibility', 'timing', 'positioning', 'decisions'] },
      },
      {
        id: 'sage-coaching-principles-001',
        text: `Sage's coaching principles — what makes the coaching effective:

1. One question at a time. The single most important rule. Most coaches and most AI tools give multiple questions or suggestions. Sage asks one. This forces the user to go deep rather than skim across the surface.

2. Questions over answers. When someone presents a problem, the instinct is to provide a solution. Sage resists this. A solution that Sage generates has zero ownership from the user. A solution the user arrives at through good questioning has full ownership and is far more likely to be acted on.

3. The situation over the emotion. Sage acknowledges feelings briefly and moves to the situation. "I hear that this is frustrating. What specifically happened?" Not "tell me more about how you're feeling."

4. Specificity over generality. "What would you do differently?" is a weak question. "If you could replay that conversation, what is the one thing you would change in the first 30 seconds?" is a strong question. The more specific the question, the more useful the answer.

5. Action before session ends. Every Sage session should end with one specific action the user commits to before the next session. Not "I'll think about it." A named action with a deadline.`,
        metadata: { category: 'framework', source: 'Sage methodology', tags: ['coaching', 'sage', 'questions'] },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // NAMESPACE: promotion
  // ══════════════════════════════════════════════════════════════════════════
  {
    namespace: 'promotion',
    chunks: [
      {
        id: 'promotion-why-001',
        text: `Why talented people don't get promoted — the three real reasons.

Reason 1: Their work is invisible. The most common reason. The professional delivers consistently, hands work over, and moves to the next task. The people making promotion decisions have an incomplete picture of what this person is capable of. The fix: make reasoning visible, not just output. "I went with option B because I anticipated the Q4 resourcing constraint" takes 10 seconds and permanently changes how judgment is perceived. Weekly one-paragraph updates to the manager — not status reports, but "here is the challenge I am working through and my current thinking" — change the picture dramatically.

Reason 2: They are optimising for the wrong thing. Technical excellence is what got them their current role. But the promotion requires demonstrating something different: leadership readiness. Can they make others better? Navigate ambiguity at a higher level? Drive outcomes they are not directly controlling? Most talented professionals keep getting better at the thing they are already good at when the promotion requires demonstrating something they have not been asked to demonstrate yet.

Reason 3: They are not in the room. Promotion decisions happen in conversations months before the formal process begins. Names come up, impressions are shared, informal verdicts form. If the person is not known to the people in those conversations, their name will not come up. Lateral connections built through work — not networking — are the fix.`,
        metadata: { category: 'promotion', tags: ['promotion', 'visibility', 'career advancement'] },
      },
      {
        id: 'promotion-moves-001',
        text: `The five specific moves that change promotion outcomes:

Move 1: Weekly one-paragraph update to your manager. Not a status report. One sentence on a challenge you are navigating and your current thinking. This makes your reasoning visible and gives your manager content to advocate for you when promotion conversations happen.

Move 2: Ask the direct question. In your next 1:1: "If you were writing a recommendation for me to move to the next level, what would be missing from that recommendation right now?" Most managers will give a real answer. Most professionals never ask.

Move 3: Volunteer for one cross-functional project. Cross-functional projects require influencing without authority, managing stakeholders with competing priorities, navigating ambiguity — exactly the skills senior roles require. They are almost impossible to demonstrate from within your immediate team alone.

Move 4: Map your stakeholders and close the gaps. Write down every senior person whose opinion could affect your next promotion. For each: have they seen evidence of your capability? If not, find the work connection — not coffee, but a genuine reason to collaborate.

Move 5: Get a sponsor, not just a mentor. A mentor advises in private. A sponsor advocates in public — in the rooms where decisions are made. You earn sponsors by delivering results that reflect well on them.`,
        metadata: { category: 'promotion', tags: ['promotion', 'visibility', 'sponsor', 'stakeholder'] },
      },
      {
        id: 'promotion-timing-001',
        text: `When to ask for a promotion — timing principles:

Best windows: After a significant achievement. After a positive performance review. At the start of a budget cycle (usually Q1 or the start of a fiscal year). When your manager is in a strong position with their own leadership.

Worst windows: During organisational stress or restructuring. When your manager is fighting their own battles. Immediately after a visible failure. When headcount is being reduced.

The direct question that opens the conversation: "I'd like to talk about my progression. I've been thinking about it and I want to have a direct conversation with you. Can we set aside 30 minutes?" Do not do this impromptu. Book it properly — it signals maturity and gives your manager time to prepare.

The most powerful question in the meeting: "What would need to be true about how I show up in the next 90 days for you to feel confident recommending me for [next level]?" Write down exactly what they say. That answer is your roadmap.

After the conversation: follow up in writing. "Following our conversation about my progression, I want to confirm what we discussed: [summary]. I'll work toward [specific things they named] over the next 90 days." Verbal agreements disappear. Written confirmation makes them real.`,
        metadata: { category: 'promotion', tags: ['promotion', 'timing', 'conversation'] },
      },
      {
        id: 'visibility-tactics-001',
        text: `Practical visibility tactics for purposeful individuals:

The weekly update habit: Every Friday, send your manager a two-sentence message. Sentence 1: one challenge or decision you navigated this week and how you handled it. Sentence 2: one thing you are focused on next week. This takes three minutes. Over 90 days it builds a complete picture of how you think.

The meeting contribution habit: In every meeting with senior stakeholders, make one substantive contribution — a question, a data point, a perspective. Not performative. One real thing. Over time, senior people start looking for your contribution.

The documentation habit: When you deliver significant work, write a three-sentence summary: what the challenge was, what you did, what the outcome was. Keep these. They become content for promotion conversations, performance reviews, and your own clarity about what you have actually accomplished.

The lateral introduction habit: Every month, find one person outside your immediate team who is relevant to your 90-day goal and find a genuine reason to work with them. Over a year, this builds a network of colleagues who know your work directly rather than by reputation.

The question habit: When you have access to a senior person, ask them one good question about how they think about their domain. People remember the person who asked the interesting question long after they forget the person who gave the competent presentation.`,
        metadata: { category: 'promotion', tags: ['visibility', 'habits', 'career tactics'] },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // NAMESPACE: salary
  // ══════════════════════════════════════════════════════════════════════════
  {
    namespace: 'salary',
    chunks: [
      {
        id: 'salary-principles-001',
        text: `Core salary negotiation principles — what every professional needs to know:

Lead with value, not need. Never negotiate from personal financial pressure ("I need more because of my rent"). Always negotiate from the value you deliver. The conversation your employer is having is about what you are worth to them, not what you need to live.

Be specific. "I'd like to discuss an increase" hands the other person full control of the range. A specific number anchors the conversation. Research your market rate before the conversation — use LinkedIn Salary, Glassdoor, conversations with peers in similar roles.

Never negotiate against yourself. When asked for a number, give one number — not a range. "I was thinking between X and Y" always results in Y being treated as the starting point, and X being where you end up. Name one number and stop talking.

Silence is a tool. After you name your number, stop talking. The instinct to fill silence is strong. Resist it. The first person to speak after a number is named is typically the one who makes a concession.

Make it easy to say yes. Think about what your manager needs to take this to their director. What concern do they need to be able to answer? What evidence do they need? Prepare that case for them.

Time the conversation. After a significant achievement, after a positive review, at the start of a budget cycle. Not during organisational stress, not after a visible failure.`,
        metadata: { category: 'salary', tags: ['salary', 'negotiation', 'compensation'] },
      },
      {
        id: 'salary-scripts-001',
        text: `Salary negotiation scripts for common situations:

Opening the conversation (no offer on table):
"I'd like to talk about my compensation. I've been thinking about it and I want to have a direct conversation. Can we set aside 20-30 minutes this week or next?"
In the meeting: "Over the last [time period], I've [specific achievement 1] and [specific achievement 2]. Based on that and what I know about market rates for this role, I'd like to discuss moving my salary to [specific number]."
After naming the number: stop talking.

Responding to a low offer:
"Thank you — I'm genuinely excited about this role. I do want to be honest with you: the number is lower than I was expecting based on my research and the scope of the role. Before I respond formally, is there flexibility in the base salary?"

The counter-offer:
"Thank you for that. I'd like to counter with [your number]. Here is my thinking: [one sentence on why — market rate, scope, specific experience]. Is that something you can work with?"

Following up after silence (5-10 days after the conversation):
"Hi [Name] — following up on our conversation about my compensation from [date]. I know you have a lot on your plate. I wanted to check in and see if you've had a chance to look into it, and if there's anything you need from me to move it forward."

If they say they need more time:
"Of course. When can we continue the conversation? I'd like to resolve it by [specific date] if possible."`,
        metadata: { category: 'salary', tags: ['salary', 'scripts', 'negotiation'] },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // NAMESPACE: leadership
  // ══════════════════════════════════════════════════════════════════════════
  {
    namespace: 'leadership',
    chunks: [
      {
        id: 'leadership-transition-001',
        text: `The transition from individual contributor to leader — what actually changes:

The fundamental shift is from "how do I deliver this?" to "how do I create conditions for others to deliver?" Most people who struggle in their first leadership role are still operating as individual contributors. They do the work themselves because it is faster and they know they will do it well. This is the trap.

What changes in the role:
- Your success is now measured by your team's output, not yours.
- Your job is to remove obstacles, provide clarity, and develop people — not to be the best technical performer.
- Decisions you used to make alone now require buy-in from people you cannot command.
- Relationships outside your team matter more than they ever did before.

What does not change: the importance of judgment, the need to deliver results, the value of being trusted.

The most common failure in the transition: the new manager tries to stay in the work. They keep doing individual contributor tasks because it feels comfortable and productive. Meanwhile, their team lacks direction, decisions get bottlenecked, and people are not being developed. The manager looks busy but is performing the wrong job.

The question every new leader should ask weekly: "What did I do this week that only I can do? What did I do that someone on my team could have done?" If most of the work falls in the second category, the manager is not leading.`,
        metadata: { category: 'leadership', tags: ['leadership', 'management', 'transition', 'individual contributor'] },
      },
      {
        id: 'executive-presence-001',
        text: `Executive presence — what it actually is and how to develop it:

Executive presence is not about confidence, charisma, or a commanding voice. Those are surface attributes. Executive presence is about the impression you create when you walk into a room: do people trust that you understand the situation, have thought it through, and will make sound decisions?

The three components that actually matter:

1. Clarity of thought. Can you describe the situation, the options, and your recommendation in three minutes or less? Can you answer "why did you decide that?" clearly and without defensiveness? Executive presence starts with thinking clearly and communicating that clarity.

2. Composure under pressure. How do you behave when things go wrong? When someone challenges you? When you do not know the answer? Leaders who panic, deflect, or overcorrect under pressure lose the confidence of the people around them quickly.

3. The ability to hold the room. This is not about speaking volume or confidence. It is about the quality of what you say. People feel held when the person speaking demonstrates they have genuinely thought about the problem, understand the stakes, and are taking the right things seriously.

How to develop it: pay attention to the people in your organisation who have it. Watch specifically what they do in the first 60 seconds when a difficult topic comes up in a meeting. That moment — how they receive the problem before they respond — is usually where executive presence is won or lost.`,
        metadata: { category: 'leadership', tags: ['executive presence', 'leadership', 'communication'] },
      },
      {
        id: 'difficult-conversations-001',
        text: `How to have difficult conversations at work — a practical framework:

Difficult conversations at work almost always fail for one reason: the person having the conversation is so focused on what they want to say that they have not thought about what the other person needs to hear.

Before the conversation, answer three questions:
1. What outcome do I want from this conversation?
2. What does the other person need to feel good about this interaction?
3. What is the most likely objection or pushback, and how will I respond?

The opening matters most. Do not bury the subject. "I wanted to talk about [the thing]" in the first 30 seconds is far better than building up to it. The other person can tell something is coming — the delay just increases anxiety on both sides.

The most useful frame: "I want to talk about [X] because I want [outcome] and I think we can get there." This is direct without being aggressive. It names your interest, not just the problem.

When they push back: do not defend immediately. "That's helpful to know — can you say more about [the specific concern]?" This buys time to think and signals you are listening rather than just waiting for your turn to speak.

After the conversation: write down what was agreed within 24 hours and confirm it with the other person. "Following our conversation, I want to confirm: [summary of what was agreed]. Does that match your understanding?" Disagreements about what was said are the source of most follow-on conflict.`,
        metadata: { category: 'leadership', tags: ['difficult conversations', 'communication', 'conflict'] },
      },
      {
        id: 'stakeholder-management-001',
        text: `Stakeholder management for purposeful individuals — how to actually do it:

Stakeholder management is not networking. Networking is building relationships speculatively. Stakeholder management is identifying the specific people whose support, trust, or opinion is required for a specific outcome — and actively managing those relationships.

Step 1: Map your stakeholders. For your 90-day goal, write down every person who matters: decision-makers (can say yes or no), influencers (advise decision-makers), blockers (can slow or stop things), and allies (actively support you).

Step 2: For each stakeholder, answer: What do they need from this situation? What are they worried about? What is their main priority right now? Most people skip this step and pay for it.

Step 3: Find the work connection. The strongest stakeholder relationships are built through doing things together. "I'd love to grab coffee" is weak. "I noticed you're working on X — I have some data on Y that might be relevant, can I share it?" is strong.

Step 4: Update them before they have to ask. The stakeholder relationship that consistently fails is the one where people only hear from you when you need something or when there is a problem. Regular, brief updates — even just "we're on track, here's what's coming next" — maintain trust at low cost.

Step 5: Address concerns before they become objections. If you know a stakeholder is worried about something, bring it up before they raise it. "I know you may have concerns about X — here's how we're thinking about that." This signals that you understand their perspective and have thought beyond your own interests.`,
        metadata: { category: 'leadership', tags: ['stakeholder management', 'influence', 'relationships'] },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // NAMESPACE: career
  // ══════════════════════════════════════════════════════════════════════════
  {
    namespace: 'career',
    chunks: [
      {
        id: 'career-stages-001',
        text: `Ascentor's three career stages and what each one requires:

EXPLORER (Early career — figuring out direction):
The primary challenge is not performance — it is orientation. What kind of work do I want to do? What environments suit me? What am I actually good at vs what I thought I'd be good at? The Explorer stage is about gathering data on yourself. The risk: mistaking the first answer for the final answer and optimising prematurely for a path that is not the right one. Sage coaching at this stage focuses on: what are you learning about yourself? What is surprising you? What would you try if you knew you could change course?

BUILDER (Mid-career — building the leadership edge):
The primary challenge is differentiation. Many people at this stage deliver well. Few are seen as clearly ready for the next level. The Builder stage requires active management of visibility, positioning, and lateral relationships — not just performance. The risk: continuing to optimise for the things that got you here when the next level requires something different. Sage coaching at this stage focuses on: what does the next level actually require, and what gap are you closing?

CLIMBER (Senior — scaling impact and building legacy):
The primary challenge is leverage. The Climber's output is no longer their own work — it is the work of the people around them and the systems they build. The risk: holding onto the identity of the high-performing individual when the role requires becoming the architect of other people's high performance. Sage coaching at this stage focuses on: what decisions can only you make, and are you spending your time there?`,
        metadata: { category: 'career', tags: ['career stages', 'explorer', 'builder', 'climber'] },
      },
      {
        id: 'career-decision-001',
        text: `How to make good career decisions — a framework for the moments that matter:

Career decisions have three distinguishing features that make them hard: they are irreversible (or nearly so), the outcomes are not knowable in advance, and they carry emotional weight that distorts thinking.

The most reliable decision-making approach for these situations:

1. Separate the decision from the emotion. Write down what you are deciding — not how you feel about it, what you are actually deciding. "Should I accept this offer?" "Should I have this conversation?" "Should I leave?" The more precise the statement of the decision, the more clearly you can reason about it.

2. Name the real criteria. What would make this the right decision? Not what you hope — what would actually make it right? Most people have implicit criteria they have never named. Naming them — even if they feel uncomfortable — dramatically improves decision quality.

3. Consider the cost of not deciding. Many people stay in indecision because deciding feels risky. But not deciding is also a decision, and it often has higher costs than either active option.

4. Ask: what would I tell someone else in this situation? Distance — treating yourself as the client rather than the person in the situation — produces clearer thinking almost every time.

5. Identify the reversibility. Is this decision reversible? If yes, decide faster and iterate. If no, decide slower and with more information. Most career decisions that feel irreversible are less irreversible than they seem.`,
        metadata: { category: 'career', tags: ['decision making', 'career', 'clarity'] },
      },
      {
        id: 'career-transition-001',
        text: `Career transitions — how to navigate them successfully:

A career transition is any move that requires you to become competent at something you are not currently competent at. This includes: moving to a new function, a new industry, a new level, or a new type of role.

The biggest mistake in transitions: treating them like a performance problem. Most people try to demonstrate their value immediately in a new role by doing the things they know how to do well. This is the wrong approach. The first 90 days in any new role are a listening and learning period, not a proving period.

What to do in the first 90 days of any transition:
1. Map the landscape — who matters, what matters, what the real priorities are (not the stated ones).
2. Build the key relationships — the three to five people whose support is most critical.
3. Identify the early win — one thing you can deliver in the first 60 days that demonstrates you understand the environment and can execute in it.
4. Ask more than you tell — the learning comes from questions, not from displaying what you already know.

The question that accelerates every transition: "What do you wish you'd known when you started in this role?" Ask this of every person who has been in a similar position before you. The answers will shortcut years of learning.

For lateral transitions (same level, different function): the hardest adjustment is the loss of status. You were competent; now you are a beginner again. Accepting the beginner identity genuinely — rather than trying to import your previous authority — is what makes lateral transitions work.`,
        metadata: { category: 'career', tags: ['transition', 'new role', 'first 90 days'] },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // NAMESPACE: coaching
  // Common situations Sage users bring and how to coach through them
  // ══════════════════════════════════════════════════════════════════════════
  {
    namespace: 'coaching',
    chunks: [
      {
        id: 'coaching-stuck-001',
        text: `When someone says they feel stuck — coaching approach:

"Stuck" is almost never a single thing. It is a label people put on a cluster of feelings and a situation they have not yet disaggregated. The coaching job is to help them separate the elements.

Questions that surface the actual issue:
- "When you say stuck, what specifically is not moving?"
- "What have you tried so far?"
- "What would 'unstuck' look like — what would be different?"
- "Is the obstacle inside you, in your relationships, or in the situation?"

Common things "stuck" actually means:
1. They know what to do but are afraid to do it — usually a difficult conversation or a decision they have been avoiding.
2. They do not know what to do — they need options generated and evaluated.
3. They are in the wrong situation — the job, relationship, or environment is genuinely not a fit, and they are hoping coaching will make it work when the real answer is a change.
4. They are exhausted — they have the clarity and the will, but not the energy. The coaching need here is different: recovery, prioritisation, permission to do less.

The coaching trap with "stuck": immediately generating options. This feels helpful but often is not, because it treats the problem as a problem of not knowing what to do — when most of the time people know what to do and need help with why they are not doing it.`,
        metadata: { category: 'coaching', tags: ['coaching', 'stuck', 'breakthrough'] },
      },
      {
        id: 'coaching-imposter-001',
        text: `When someone experiences imposter syndrome — coaching approach:

Imposter syndrome is the persistent feeling that one's success is not deserved and will eventually be exposed as fraud. It is extremely common among high-achieving professionals — particularly those moving into new levels of responsibility.

What imposter syndrome is not: a sign that the person is actually underperforming or out of their depth. It is frequently highest in people who are most competent, because competence makes you aware of how much you don't know.

The coaching distinction that matters most: is this imposter syndrome (distorted perception of real competence) or legitimate skill gap (accurate perception of real development need)?

Questions to distinguish:
- "What specific evidence do you have that you are not capable of this role?"
- "What would someone who genuinely was capable of this role look like? How does that compare to you?"
- "What feedback have you received from people you trust about your performance?"

If it is imposter syndrome: the coaching job is not to reassure ("you're great, don't worry") — that does not work. It is to help the person build an accurate model of their own competence by examining the evidence deliberately.

If it is a legitimate skill gap: name it clearly and build a plan to close it. Pretending the gap is not there does not serve anyone.

The most useful reframe: "What would you need to know or be able to do to feel confident in this role? Is that knowable and learnable?" This transforms anxiety into a development agenda.`,
        metadata: { category: 'coaching', tags: ['imposter syndrome', 'confidence', 'self-doubt'] },
      },
      {
        id: 'coaching-manager-conflict-001',
        text: `When someone has a difficult relationship with their manager — coaching approach:

Manager relationships are the single biggest driver of career outcomes for most professionals. A great manager accelerates everything; a bad manager can derail even a very talented person.

The coaching job is to help the person understand the situation accurately before deciding what to do about it.

Questions that surface the real picture:
- "What specifically is your manager doing or not doing that is the problem?"
- "How long has this been the case? Was it always like this or did something change?"
- "What does your manager need from you — not what you think they should need, what do they actually seem to need?"
- "Have you told your manager directly what is not working for you? What happened?"

The four types of manager problem and what each requires:
1. The absent manager — gives no feedback, no direction, no development. Fix: manage up aggressively. Ask directly for what you need. Book the 1:1s yourself.
2. The micromanager — too involved, does not trust. Fix: build trust through consistent delivery and transparency. Proactively update before they ask. Earn distance.
3. The unfair manager — inconsistent treatment, takes credit, plays favourites. Fix: document everything, build relationships outside the manager, assess whether the situation can change.
4. The incompetent manager — simply not good at the job. Fix: manage around. Get what you need from other relationships. Focus on the output you can control.

The question before any escalation: "Have I told my manager, clearly and directly, what is not working and what I need?" Most people answer no. The conversation is almost always worth having before escalation.`,
        metadata: { category: 'coaching', tags: ['manager', 'relationship', 'conflict', 'difficult manager'] },
      },
      {
        id: 'coaching-burnout-001',
        text: `When someone is experiencing burnout or overwhelm — coaching approach:

Burnout is not a productivity problem. Coaching it as a productivity problem — "how can you work more efficiently?" — makes it worse.

Burnout has three components (Maslach model): exhaustion, cynicism (disconnection from the work), and reduced sense of efficacy. Most professionals notice the exhaustion and try to address it with rest, which helps temporarily but does not address the cynicism or the efficacy component.

The coaching questions that matter:
- "When did this start — was there a specific moment or has it been gradual?"
- "What is the work taking from you that it is not giving back?"
- "Is there anything about the work that still feels meaningful to you?"
- "What would you need to feel like the work was sustainable again?"

The distinction that changes the coaching:
- Burnout from too much good work (sustainable overwhelm): the need is boundaries and prioritisation.
- Burnout from meaningless work (values misalignment): the need is a change in the work itself, not better management of it.
- Burnout from a toxic environment: the need is exit, not coping strategies.

What to avoid in coaching burnout: productivity frameworks, time management techniques, "have you tried [wellness practice]?" None of these address the root cause and can make the person feel blamed for the situation.

The honest coaching commitment: Sage can help you think clearly about what is happening and what you want to do about it. It cannot fix an environment that is genuinely making you unwell. If the situation is the latter, the coaching job is to help you see that clearly enough to act on it.`,
        metadata: { category: 'coaching', tags: ['burnout', 'overwhelm', 'wellbeing', 'sustainability'] },
      },
      {
        id: 'coaching-career-change-001',
        text: `When someone wants to change careers — coaching approach:

Career change conversations are among the most common and most emotionally loaded. They are also frequently misdiagnosed — many people who say they want to change careers actually want to change their situation within their current career.

The diagnostic questions:
- "What specifically are you trying to move away from?"
- "What would the new path give you that this one doesn't?"
- "Have you explored what the new path actually looks like day-to-day, not just in the abstract?"
- "Is there a version of your current path that would give you what you're looking for?"

The three types of career change:
1. Function change (e.g., finance to marketing): relatively manageable. Transferable skills, learnable new domain, clear transition path.
2. Industry change (e.g., banking to tech): medium complexity. Some skills transfer, significant context to learn, relationships to rebuild.
3. Identity change (e.g., corporate employee to entrepreneur, or senior leader to early-career specialist): high complexity. Requires genuine renegotiation of self-concept, status, and relationships. Many people underestimate this.

The questions that test commitment:
- "What have you done in the last 6 months to move toward this?"
- "What is the smallest version of this change you could try without fully committing?"
- "What would you need to give up to make this change? Are you ready to give that up?"

The coaching job is not to validate the desire for change or to talk the person out of it — it is to help them see the decision clearly so they can make it with full awareness of what it requires.`,
        metadata: { category: 'coaching', tags: ['career change', 'transition', 'clarity'] },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // NAMESPACE: community
  // ══════════════════════════════════════════════════════════════════════════
  {
    namespace: 'community',
    chunks: [
      {
        id: 'peer-cohort-value-001',
        text: `Why peer cohorts accelerate career growth — the evidence and the mechanism:

Research on professional development consistently shows that peer accountability produces better outcomes than individual commitment alone. The mechanism is not social pressure — it is the quality of thinking that comes from having to articulate your situation to someone who knows it.

The Ascentor cohort model: 8 professionals at the same career stage, 90-day commitment, weekly check-in, shared goal-setting, and end-of-cycle review. The number 8 is deliberate — small enough that everyone knows each other's situation, large enough to have diverse perspectives.

What cohorts provide that Sage alone cannot:
1. People who have lived through what you are navigating. Sage draws on frameworks. Cohort members draw on experience. The difference matters when the situation is ambiguous.
2. Accountability with relationship. Missing a commitment to Sage has no consequence. Missing a commitment to a cohort of eight people who know your goal has a different weight.
3. The witness effect. When someone knows your specific situation and is watching what happens, your attention to it changes. You notice things you would otherwise rationalise away.
4. Normalisation. Hearing that eight other purposeful individuals at your level are navigating similar challenges removes the isolation that makes hard situations feel unique and therefore hopeless.

The most common report from cohort members: "I knew what I needed to do. Having eight people who knew my situation was what made me actually do it."`,
        metadata: { category: 'community', tags: ['cohort', 'accountability', 'peer learning', 'community'] },
      },
    ],
  },
];

async function main() {
  console.log('Starting Ascentor knowledge base seeding...\n');

  let totalChunks = 0;

  for (const { namespace, chunks } of KNOWLEDGE) {
    console.log(`Seeding namespace: ${namespace} (${chunks.length} chunks)...`);
    try {
      await addChunks(namespace, chunks);
      totalChunks += chunks.length;
      console.log(`  ✓ Done\n`);
    } catch (err) {
      console.error(`  ✗ Failed: ${err}\n`);
    }
  }

  console.log(`\n✓ Seeding complete. ${totalChunks} chunks uploaded across ${KNOWLEDGE.length} namespaces.`);
  console.log('\nNamespaces seeded:');
  KNOWLEDGE.forEach(({ namespace, chunks }) =>
    console.log(`  ${namespace}: ${chunks.length} chunks`)
  );
}

main().catch(console.error);
