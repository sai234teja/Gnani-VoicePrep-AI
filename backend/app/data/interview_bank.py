from typing import List, Dict, Optional
from app.models import QuestionItem

ROLES_METADATA = [
    {
        "id": "java-dev",
        "name": "Java Developer",
        "default_tech": ["Java", "Spring Boot", "Hibernate", "Microservices", "PostgreSQL", "Kafka"],
        "description": "Backend services, multithreading, JVM internals, Spring ecosystems, and enterprise architectures."
    },
    {
        "id": "python-fullstack",
        "name": "Python Full Stack",
        "default_tech": ["Python", "FastAPI", "Django", "React", "Celery", "PostgreSQL", "Redis"],
        "description": "End-to-end applications, async Python, REST APIs, state management, and relational modeling."
    },
    {
        "id": "mern-stack",
        "name": "MERN Stack",
        "default_tech": ["MongoDB", "Express", "React", "Node.js", "TypeScript", "Redux", "Docker"],
        "description": "Full stack JavaScript/TypeScript, document stores, async event loops, and modern React patterns."
    },
    {
        "id": "frontend-dev",
        "name": "Frontend Developer",
        "default_tech": ["React", "JavaScript", "TypeScript", "Tailwind CSS", "Next.js", "Web Performance"],
        "description": "UI component architecture, state management, Core Web Vitals, accessibility, and modern CSS."
    },
    {
        "id": "backend-dev",
        "name": "Backend Developer",
        "default_tech": ["Go / Python / Node", "Distributed Systems", "SQL / NoSQL", "Message Queues", "Caching"],
        "description": "API design, scalability, database indexing, concurrency, and high availability systems."
    },
    {
        "id": "data-analyst",
        "name": "Data Analyst",
        "default_tech": ["SQL", "Python / Pandas", "Tableau / PowerBI", "Statistical Modeling", "Data Pipelines"],
        "description": "Data wrangling, analytical dashboards, SQL queries, metric definitions, and hypothesis testing."
    },
    {
        "id": "software-eng",
        "name": "Software Engineer",
        "default_tech": ["Data Structures", "Algorithms", "System Design", "Clean Code", "Design Patterns", "CI/CD"],
        "description": "General engineering fundamentals, algorithmic trade-offs, modular design, and collaborative development."
    }
]

# Mandatory universal self-introduction question
INTRO_QUESTION = QuestionItem(
    id="intro-self",
    role_id="universal",
    category="self_introduction",
    difficulty="easy",
    title="Could you please tell me about yourself?",
    title_te="దయచేసి మీ గురించి కొంచెం చెప్పండి?",
    title_hi="क्या आप कृपया मुझे अपने बारे में बता सकते हैं?",
    context="Candidate should introduce their technical background, primary tools, notable achievements, and professional interests.",
    key_points=["background", "education", "experience", "projects", "skills", "passion", "career", "technologies"],
    follow_up_guidance="Acknowledge their background and transition seamlessly to their technical stack."
)

QUESTION_BANK: List[QuestionItem] = [
    # Universal Self-Introduction
    INTRO_QUESTION,

    # --- Java Developer ---
    QuestionItem(
        id="java-1",
        role_id="java-dev",
        category="technical_knowledge",
        difficulty="easy",
        title="Explain how Java handles memory management with the Garbage Collector.",
        title_te="గార్బేజ్ కలెక్టర్ ద్వారా జావా మెమరీ నిర్వహణను ఎలా చేస్తుందో వివరించండి.",
        title_hi="जावा गारबेज कलेक्टर के माध्यम से मेमोरी प्रबंधन कैसे करता है, समझाएं।",
        context="Discuss heap memory divisions (Young, Old/Tenured, Metaspace) and GC algorithms like G1 or ZGC.",
        key_points=["heap", "garbage collection", "young generation", "old generation", "metaspace", "g1gc", "stop the world", "memory leak"],
        follow_up_guidance="Ask how they would diagnose a java.lang.OutOfMemoryError in production."
    ),
    QuestionItem(
        id="java-2",
        role_id="java-dev",
        category="technical_knowledge",
        difficulty="medium",
        title="How does Spring Boot manage dependency injection and bean lifecycles under concurrent loads?",
        title_te="స్ప్రింగ్ బూట్ డిపెండెన్సీ ఇంజెక్షన్ మరియు బీన్ లైఫ్‌సైకిల్‌ను ఎలా నిర్వహిస్తుంది?",
        title_hi="स्प्रिंग बूट डिपेंडेंसी इंजेक्शन और बीन लाइफसाइकिल को समवर्ती लोड के तहत कैसे संभालता है?",
        context="Cover singleton vs prototype bean scopes, @Autowired/@Qualifier, application context, and thread safety.",
        key_points=["bean scope", "singleton", "thread safety", "dependency injection", "applicationcontext", "ioc container", "prototype"],
        follow_up_guidance="Ask about handling stateful data in a singleton bean."
    ),
    QuestionItem(
        id="java-3",
        role_id="java-dev",
        category="problem_solving",
        difficulty="hard",
        title="Design a resilient event-driven microservices architecture using Spring Cloud and Kafka.",
        title_te="స్ప్రింగ్ క్లౌడ్ మరియు కాఫ్కాను ఉపయోగించి బలమైన ఈవెంట్-ఆధారిత మైక్రోసర్వీసెస్ ఆర్కిటెక్చర్‌ను ఎలా డిజైన్ చేస్తారు?",
        title_hi="स्प्रिंग क्लाउड और काफ्का का उपयोग करके एक लचीली इवेंट-चालित माइक्रोसर्विसेज आर्किटेक्चर कैसे डिजाइन करेंगे?",
        context="Focus on idempotency, consumer offset management, dead letter queues, and distributed transactions (Saga pattern).",
        key_points=["kafka", "event driven", "saga pattern", "dead letter queue", "idempotency", "circuit breaker", "distributed transaction", "resilience"],
        follow_up_guidance="How do you handle schema evolution across multiple publishing services?"
    ),
    QuestionItem(
        id="java-4",
        role_id="java-dev",
        category="project_experience",
        difficulty="medium",
        title="Can you share a challenging enterprise Java project you built, specifically how you tuned database queries or connection pools?",
        context="Discuss HikariCP pool sizing, JPA N+1 query troubleshooting, indexing strategies, and read replicas.",
        key_points=["hikaricp", "jpa", "hibernate", "n+1 query", "connection pool", "indexes", "query optimization", "metrics"],
        follow_up_guidance="What were the before-and-after latency metrics?"
    ),
    QuestionItem(
        id="java-5",
        role_id="java-dev",
        category="scenario_based",
        difficulty="medium",
        title="Suppose your production Spring microservice starts throwing OutOfMemory errors during peak hours. Walk me through your triage process.",
        context="Cover heap dumps (jcmd, jmap), analyzing with Eclipse MAT, checking GC pause logs, memory leak vs traffic spike.",
        key_points=["heap dump", "mat", "gc logs", "memory leak", "jcmd", "jstack", "thread dump", "mitigation"],
        follow_up_guidance="How would you safely extract a heap dump without crashing the remaining live pods?"
    ),

    # --- Python Full Stack ---
    QuestionItem(
        id="py-1",
        role_id="python-fullstack",
        category="technical_knowledge",
        difficulty="easy",
        title="Compare FastAPI and Django. In what scenarios would you choose one over the other?",
        title_te="ఫాస్ట్‌ఏపీఐ మరియు జాంగోలను పోల్చండి. వేర్వేరు పరిస్థితుల్లో దేన్ని ఎంచుకుంటారు?",
        title_hi="फास्टएपीआई और जैंगो की तुलना करें। आप किस स्थिति में किसे चुनेंगे?",
        context="Examine async performance, ORM built-ins, battery-included administration, and microservice vs monolith trade-offs.",
        key_points=["fastapi", "django", "asyncio", "pydantic", "orm", "admin", "monolith", "microservices", "performance"],
        follow_up_guidance="Ask how FastAPI utilizes Python type hinting for automatic validation."
    ),
    QuestionItem(
        id="py-2",
        role_id="python-fullstack",
        category="problem_solving",
        difficulty="medium",
        title="How does Python's asyncio event loop operate, and how do you prevent blocking calls in async route handlers?",
        title_te="పైథాన్ అసింక్ ఈవెంట్ లూప్ ఎలా పనిచేస్తుంది మరియు బ్లాకింగ్ కాల్‌లను ఎలా నివారిస్తారు?",
        title_hi="पायथन का एसिंक इवेंट लूप कैसे काम करता है, और आप रूट हैंडलर में ब्लॉकिंग कॉल्स को कैसे रोकते हैं?",
        context="Discuss asyncio.run, task scheduling, coroutines, thread executors for CPU-bound tasks, and uvloop.",
        key_points=["event loop", "asyncio", "coroutine", "run_in_executor", "blocking call", "gil", "non-blocking", "multiprocessing"],
        follow_up_guidance="How does asyncio compare with OS-level multiprocessing in Python?"
    ),
    QuestionItem(
        id="py-3",
        role_id="python-fullstack",
        category="project_experience",
        difficulty="medium",
        title="Describe a full stack application where you integrated React with a Python backend. How did you structure state synchronization and API contracts?",
        context="Discuss OpenAPI/Swagger types, JWT auth tokens, WebSockets vs REST polling, and optimistic UI updates.",
        key_points=["react", "fastapi", "rest api", "jwt", "state management", "tanstack query", "websockets", "error handling"],
        follow_up_guidance="How did you handle token refreshing without disturbing active user workflows?"
    ),
    QuestionItem(
        id="py-4",
        role_id="python-fullstack",
        category="scenario_based",
        difficulty="hard",
        title="Imagine your Celery background workers are consuming 100% CPU processing heavy data jobs, starving user-facing web requests. How would you solve this?",
        context="Cover task queue priority queues, prefetch limits, Celery routing, Redis/RabbitMQ broker backpressure, and autoscale workers.",
        key_points=["celery", "worker", "queue priority", "redis", "prefetch", "rate limiting", "concurrency", "horizontal scaling"],
        follow_up_guidance="How do you ensure duplicate tasks are discarded if a worker restarts mid-execution?"
    ),

    # --- MERN Stack ---
    QuestionItem(
        id="mern-1",
        role_id="mern-stack",
        category="technical_knowledge",
        difficulty="medium",
        title="Explain the Node.js Event Loop phases and how Node processes microtasks versus macrotasks.",
        context="Explain timers, I/O callbacks, idle/prepare, poll, check (setImmediate), and close callbacks with process.nextTick and Promise microtasks.",
        key_points=["event loop", "microtasks", "macrotasks", "nexttick", "setimmediate", "settimeout", "libuv", "call stack"],
        follow_up_guidance="Why does process.nextTick execute before standard Promise resolutions?"
    ),
    QuestionItem(
        id="mern-2",
        role_id="mern-stack",
        category="problem_solving",
        difficulty="medium",
        title="In MongoDB, how do you optimize complex aggregation pipelines and choose compound index key order?",
        context="Discuss equality-sort-range (ESR) rule, $match early filtering, index prefixing, and explain('executionStats').",
        key_points=["mongodb", "aggregation pipeline", "compound index", "esr rule", "match", "index scan", "executionstats"],
        follow_up_guidance="When would you denormalize data versus using $lookup in production?"
    ),
    QuestionItem(
        id="mern-3",
        role_id="mern-stack",
        category="project_experience",
        difficulty="medium",
        title="Tell me about a production MERN application you built. How did you manage security against XSS, CSRF, and injection attacks?",
        context="Cover sanitize-html, helmet, httpOnly secure SameSite cookies, JWT storage best practices, and mongoose schema sanitization.",
        key_points=["xss", "csrf", "httponly cookies", "cors", "helmet", "jwt", "sanitization", "rate limiting"],
        follow_up_guidance="Why should sensitive JWT tokens never be stored in browser localStorage?"
    ),

    # --- Frontend Developer ---
    QuestionItem(
        id="fe-1",
        role_id="frontend-dev",
        category="technical_knowledge",
        difficulty="easy",
        title="Explain how React 18 Concurrent Mode and Fiber architecture optimize rendering performance.",
        title_te="రియాక్ట్ 18 కాన్‌కరెంట్ మోడ్ మరియు ఫైబర్ ఆర్కిటెక్చర్ రెండరింగ్ పనితీరును ఎలా మెరుగుపరుస్తాయో వివరించండి.",
        title_hi="समझाएं कि रिएक्ट 18 समवर्ती मोड और फाइबर आर्किटेक्चर रेंडरिंग प्रदर्शन को कैसे अनुकूलित करते हैं।",
        context="Examine priority-based scheduling, interruptible rendering, useTransition, and Reconciliation algorithm.",
        key_points=["fiber", "concurrent mode", "reconciliation", "usetransition", "virtual dom", "priority scheduling", "batching"],
        follow_up_guidance="When should you avoid using useMemo or useCallback?"
    ),
    QuestionItem(
        id="fe-2",
        role_id="frontend-dev",
        category="problem_solving",
        difficulty="medium",
        title="How do you systematically identify and fix Core Web Vitals issues, particularly Largest Contentful Paint and Interaction to Next Paint?",
        title_te="కోర్ వెబ్ వైటల్స్ సమస్యలను (LCP, INP, CLS) ఎలా గుర్తించి పరిష్కరిస్తారు?",
        title_hi="आप कोर वेब वाइटल्स (LCP, INP, CLS) की समस्याओं को व्यवस्थित रूप से कैसे पहचानेंगे और ठीक करेंगे?",
        context="Detail profiling tools (Chrome DevTools, Lighthouse), image optimization, font display, code splitting, and long task decomposition.",
        key_points=["lcp", "inp", "cls", "core web vitals", "lighthouse", "code splitting", "lazy loading", "layout shift", "long tasks"],
        follow_up_guidance="How does Interaction to Next Paint (INP) differ from First Input Delay (FID)?"
    ),
    QuestionItem(
        id="fe-3",
        role_id="frontend-dev",
        category="project_experience",
        difficulty="medium",
        title="Can you describe a complex interactive UI component or design system element you built from scratch? How did you ensure accessibility (a11y) and keyboard navigation?",
        context="Cover WAI-ARIA roles, focus trapping in modals, keyboard listeners (Escape, Tab), screen reader labels, and color contrast.",
        key_points=["accessibility", "aria", "keyboard navigation", "focus trap", "design system", "contrast", "wcag", "screen reader"],
        follow_up_guidance="How do you automatedly test for accessibility regressions in CI/CD?"
    ),
    QuestionItem(
        id="fe-4",
        role_id="frontend-dev",
        category="scenario_based",
        difficulty="medium",
        title="A candidate dashboard page experiences sluggish scrolling and frame drops when rendering lists with thousands of items. How would you resolve this?",
        context="Discuss list virtualization (react-window/virtualizer), CSS containment, avoiding heavy inline closures, and memoizing row components.",
        key_points=["virtualization", "react-window", "dom nodes", "re-render", "memo", "css containment", "requestanimationframe", "performance"],
        follow_up_guidance="What are the trade-offs of windowing when users search via Ctrl+F?"
    ),

    # --- Backend Developer ---
    QuestionItem(
        id="be-1",
        role_id="backend-dev",
        category="technical_knowledge",
        difficulty="medium",
        title="Explain the differences between optimistic locking and pessimistic locking with a real-world scenario.",
        title_te="ఆప్టిమిస్టిక్ లాకింగ్ మరియు పెసిమిస్టిక్ లాకింగ్ మధ్య తేడాలను ఉదాహరణతో వివరించండి.",
        title_hi="वास्तविक परिदृश्य के साथ आशावादी लॉकिंग और निराशावादी लॉकिंग के बीच अंतर समझाएं।",
        context="Discuss version columns vs SELECT FOR UPDATE, high contention vs low contention tradeoffs, and deadlock prevention.",
        key_points=["optimistic lock", "pessimistic lock", "select for update", "version column", "concurrency", "deadlock", "transaction isolation"],
        follow_up_guidance="How would you implement ticket booking with hundreds of users attempting to purchase the same seat?"
    ),
    QuestionItem(
        id="be-2",
        role_id="backend-dev",
        category="problem_solving",
        difficulty="hard",
        title="How would you design a distributed rate limiter that handles millions of requests per second across multiple regional clusters?",
        title_te="ప్రతి సెకనుకు మిలియన్ల అభ్యర్థనలను నిర్వహించే పంపిణీ చేయబడిన రేట్ లిమిటర్‌ను ఎలా డిజైన్ చేస్తారు?",
        title_hi="प्रति सेकंड लाखों अनुरोधों को संभालने वाले डिस्ट्रीब्यूटेड रेट लिमिटर को आप कैसे डिज़ाइन करेंगे?",
        context="Cover token bucket or sliding window algorithms, Redis cluster with Lua scripts, synchronization latency, and graceful degradation.",
        key_points=["rate limiter", "token bucket", "sliding window", "redis", "lua script", "concurrency", "distributed system", "fallback"],
        follow_up_guidance="What happens if the centralized Redis cache goes down temporarily?"
    ),
    QuestionItem(
        id="be-3",
        role_id="backend-dev",
        category="project_experience",
        difficulty="medium",
        title="Describe a distributed system project where you had to manage database transactions across multiple microservices. How did you ensure data consistency?",
        context="Cover two-phase commit limitations, Saga orchestrator vs choreography, compensating transactions, and outbox pattern.",
        key_points=["saga pattern", "transactional outbox", "eventual consistency", "idempotency", "kafka", "compensation", "acid"],
        follow_up_guidance="How do you handle a compensation failure in the middle of a saga chain?"
    ),

    # --- Data Analyst ---
    QuestionItem(
        id="da-1",
        role_id="data-analyst",
        category="technical_knowledge",
        difficulty="easy",
        title="Explain the difference between WHERE and HAVING in SQL, and walk through an example using window functions.",
        title_te="SQL లో WHERE మరియు HAVING మధ్య తేడాను మరియు విండో ఫంక్షన్ల ఉదాహరణను వివరించండి.",
        title_hi="SQL में WHERE और HAVING के बीच अंतर समझाएं, और विंडो फ़ंक्शंस का उपयोग करके एक उदाहरण दें।",
        context="Explain query execution order, row-level filtering vs aggregated group filtering, and functions like ROW_NUMBER(), RANK(), or DENSE_RANK().",
        key_points=["where", "having", "group by", "aggregation", "window functions", "row_number", "rank", "dense_rank", "partition by"],
        follow_up_guidance="How would you find the 2nd highest salary in each department using window functions?"
    ),
    QuestionItem(
        id="da-2",
        role_id="data-analyst",
        category="problem_solving",
        difficulty="medium",
        title="How would you evaluate if a recent checkout page redesign led to a statistically significant increase in conversions?",
        title_te="చెక్అవుట్ పేజీ రీడిజైన్ వల్ల మార్పిడులు గణాంకపరంగా గణనీయంగా పెరిగాయో లేదో ఎలా అంచనా వేస్తారు?",
        title_hi="आप कैसे मूल्यांकन करेंगे कि हाल ही में चेकआउट पेज के नए डिज़ाइन से रूपांतरणों में सांख्यिकीय रूप से महत्वपूर्ण वृद्धि हुई है?",
        context="Discuss A/B test setup, sample size calculation, p-values, null hypothesis, confidence intervals, and confounding variables.",
        key_points=["a/b test", "conversion rate", "statistical significance", "p-value", "null hypothesis", "sample size", "confidence interval"],
        follow_up_guidance="What are novelty effects and how do you protect against them in online experimentation?"
    ),

    # --- General Software Engineer ---
    QuestionItem(
        id="se-gen-1",
        role_id="software-eng",
        category="problem_solving",
        difficulty="medium",
        title="Describe how you would design a scalable notifications service supporting SMS, Email, and Push notifications.",
        title_te="ఎస్ఎంఎస్, ఈమెయిల్ మరియు పుష్ నోటిఫికేషన్‌లను సమర్ధించే స్కేలబుల్ నోటిఫికేషన్ సర్వీస్‌ను ఎలా డిజైన్ చేస్తారు?",
        title_hi="एसएमएस, ईमेल और पुश नोटिफिकेशन का समर्थन करने वाली एक स्केलेबल नोटिफिकेशन सेवा को आप कैसे डिज़ाइन करेंगे?",
        context="Cover decoupled ingestion queues, priority dispatching, rate limits per provider, failure retries, and user preference management.",
        key_points=["notification service", "message queue", "kafka", "sqs", "priority queue", "idempotency", "rate limiting", "third party api"],
        follow_up_guidance="How do you prevent duplicate notification dispatch if the downstream provider experiences a network timeout?"
    ),
    QuestionItem(
        id="se-gen-2",
        role_id="software-eng",
        category="technical_knowledge",
        difficulty="hard",
        title="Explain how distributed caching works and how you address cache stampede and cache penetration.",
        title_te="డిస్ట్రిబ్యూటెడ్ క్యాషింగ్ ఎలా పనిచేస్తుంది మరియు క్యాష్ స్టాంపేడ్, పెనెట్రేషన్ సమస్యలను ఎలా నివారిస్తారు?",
        title_hi="डिस्ट्रीब्यूटेड कैशिंग कैसे काम करती है और आप कैश स्टैम्पेड और कैश पेनेट्रेशन की समस्याओं को कैसे हल करते हैं?",
        context="Discuss cache eviction policies (LRU/LFU), probabilistic early expiration, mutex locks on cache miss, and Bloom filters.",
        key_points=["cache stampede", "cache penetration", "bloom filter", "mutex", "probabilistic early expiration", "redis", "ttl", "lru"],
        follow_up_guidance="How do you handle strong cache invalidation in a multi-region deployment?"
    ),

    # --- Behavioural & HR Questions (Universal) ---
    QuestionItem(
        id="beh-1",
        role_id="universal",
        category="behavioural",
        difficulty="medium",
        title="Tell me about a time when you strongly disagreed with a team decision or technical design. How did you handle it and what was the outcome?",
        context="Candidate should demonstrate emotional intelligence, active listening, backing arguments with data, and disagree-and-commit culture.",
        key_points=["disagreement", "communication", "data driven", "compromise", "disagree and commit", "collaboration", "respect", "result"],
        follow_up_guidance="Did the final outcome validate your original concern or the team's direction?"
    ),
    QuestionItem(
        id="beh-2",
        role_id="universal",
        category="behavioural",
        difficulty="medium",
        title="Describe a situation where a production incident occurred on a system you maintained. How did you communicate with stakeholders and resolve it?",
        context="Candidate should discuss rapid mitigation over root cause, clear incident status communication, and blameless post-mortems.",
        key_points=["incident", "post mortem", "root cause", "blameless", "stakeholder communication", "rollback", "resilience"],
        follow_up_guidance="What preventative action did you put in place to ensure that specific failure never reoccurred?"
    ),
    QuestionItem(
        id="hr-1",
        role_id="universal",
        category="hr",
        difficulty="easy",
        title="What kind of engineering culture or work environment helps you do your best work, and how do you organize your priorities?",
        context="Assess alignment with autonomy, continuous learning, mentorship, transparent documentation, and delivery cadence.",
        key_points=["culture", "mentorship", "autonomy", "continuous learning", "collaboration", "prioritization", "ownership"],
        follow_up_guidance="How do you balance tech debt cleanup with shipping urgent business features?"
    )
]

def get_role_metadata(role_id: str) -> Dict:
    for r in ROLES_METADATA:
        if r["id"] == role_id:
            return r
    return ROLES_METADATA[-1]

def get_questions_for_role(role_id: str, include_universal: bool = True) -> List[QuestionItem]:
    role_questions = [q for q in QUESTION_BANK if q.role_id == role_id]
    if include_universal:
        universal = [q for q in QUESTION_BANK if q.role_id == "universal" and q.category != "self_introduction"]
        role_questions.extend(universal)
        
    if not role_questions:
        # Fallback to software engineer questions
        role_questions = [q for q in QUESTION_BANK if q.role_id in ("software-eng", "universal") and q.category != "self_introduction"]
    return role_questions

def get_intro_question() -> QuestionItem:
    return INTRO_QUESTION
