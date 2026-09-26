/* Marsam — diagram content: templates, diagram-type detection and snippets, in Arabic and English.
   A value of the form { ar, en } is picked by the interface language; a plain string is shared. */
'use strict';

const MARSAM_TEMPLATES = [
  { key: 'flowchart', group: 'grpBasic', kw: 'flowchart', name: { ar: 'مخطط انسيابي', en: 'Flowchart' }, code: {
    ar: `---
title: مسار طلب الشراء
---
flowchart TD
    start([بداية]) --> receive[استلام الطلب]
    receive --> stock{هل المنتج متوفر؟}
    stock -- نعم --> pay[تأكيد الدفع]
    stock -- لا --> notify[إشعار العميل]
    pay --> db[(قاعدة البيانات)]
    pay --> ship[/شحن الطلب/]
    notify --> finish([نهاية])
    ship --> finish

    classDef key fill:#E7ECFC,stroke:#2B4ACB,color:#1B2A6B
    class pay,ship key`,
    en: `---
title: Order checkout flow
---
flowchart TD
    start([Start]) --> receive[Receive order]
    receive --> stock{In stock?}
    stock -- Yes --> pay[Confirm payment]
    stock -- No --> notify[Notify customer]
    pay --> db[(Database)]
    pay --> ship[/Ship order/]
    notify --> finish([End])
    ship --> finish

    classDef key fill:#E7ECFC,stroke:#2B4ACB,color:#1B2A6B
    class pay,ship key` } },

  { key: 'sequence', group: 'grpBasic', kw: 'sequenceDiagram', name: { ar: 'مخطط تسلسلي', en: 'Sequence' }, code: {
    ar: `sequenceDiagram
    autonumber
    actor U as المستخدم
    participant W as الواجهة
    participant A as خادم المصادقة
    participant D as قاعدة البيانات
    U->>W: إدخال البريد وكلمة المرور
    W->>A: طلب تسجيل الدخول
    activate A
    A->>D: التحقق من بيانات الحساب
    D-->>A: الحساب صالح
    alt بيانات صحيحة
        A-->>W: رمز الدخول JWT
        W-->>U: الانتقال إلى لوحة التحكم
    else بيانات خاطئة
        A-->>W: خطأ 401
        W-->>U: رسالة خطأ
    end
    deactivate A
    Note over U,W: تبقى الجلسة فعّالة 24 ساعة`,
    en: `sequenceDiagram
    autonumber
    actor U as User
    participant W as Web app
    participant A as Auth server
    participant D as Database
    U->>W: Enter email and password
    W->>A: Sign-in request
    activate A
    A->>D: Verify account
    D-->>A: Account is valid
    alt Valid credentials
        A-->>W: JWT access token
        W-->>U: Open the dashboard
    else Invalid credentials
        A-->>W: 401 error
        W-->>U: Show error message
    end
    deactivate A
    Note over U,W: The session stays active for 24 hours` } },

  { key: 'class', group: 'grpBasic', kw: 'classDiagram', name: { ar: 'مخطط الأصناف', en: 'Classes' }, code: {
    ar: `classDiagram
    direction LR
    class Account["الحساب"] {
        +String owner
        +Decimal balance
        +deposit(amount) bool
        +withdraw(amount) bool
    }
    class Savings["حساب توفير"] {
        +float rate
        +addInterest()
    }
    class Current["حساب جارٍ"] {
        +Decimal overdraft
    }
    class Customer["العميل"] {
        +String name
        +String phone
    }
    Account <|-- Savings
    Account <|-- Current
    Customer "1" --> "*" Account : يملك`,
    en: `classDiagram
    direction LR
    class Account {
        +String owner
        +Decimal balance
        +deposit(amount) bool
        +withdraw(amount) bool
    }
    class Savings {
        +float rate
        +addInterest()
    }
    class Current {
        +Decimal overdraft
    }
    class Customer {
        +String name
        +String phone
    }
    Account <|-- Savings
    Account <|-- Current
    Customer "1" --> "*" Account : owns` } },

  { key: 'state', group: 'grpBasic', kw: 'stateDiagram-v2', name: { ar: 'مخطط الحالات', en: 'States' }, code: {
    ar: `stateDiagram-v2
    Draft: مسودة
    Review: قيد المراجعة
    Published: منشور
    Archived: مؤرشف
    [*] --> Draft
    Draft --> Review: إرسال للمراجعة
    Review --> Draft: طلب تعديلات
    Review --> Published: موافقة
    Published --> Archived: أرشفة
    Archived --> [*]
    note right of Review
        يراجع المحرر المحتوى
        خلال يومي عمل
    end note`,
    en: `stateDiagram-v2
    Draft: Draft
    Review: In review
    Published: Published
    Archived: Archived
    [*] --> Draft
    Draft --> Review: Submit for review
    Review --> Draft: Request changes
    Review --> Published: Approve
    Published --> Archived: Archive
    Archived --> [*]
    note right of Review
        An editor reviews the content
        within two working days
    end note` } },

  { key: 'er', group: 'grpBasic', kw: 'erDiagram', name: { ar: 'الكيانات والعلاقات', en: 'Entity relationship' }, code: {
    ar: `erDiagram
    CUSTOMER ||--o{ ORDER : "يقدّم"
    ORDER ||--|{ ORDER_ITEM : "يحتوي"
    PRODUCT ||--o{ ORDER_ITEM : "يظهر في"
    CUSTOMER {
        int id PK
        string name "الاسم الكامل"
        string email UK "البريد الإلكتروني"
    }
    ORDER {
        int id PK
        int customer_id FK
        date created_at "تاريخ الطلب"
        string status "الحالة"
    }
    ORDER_ITEM {
        int order_id FK
        int product_id FK
        int quantity "الكمية"
    }
    PRODUCT {
        int id PK
        string title "اسم المنتج"
        decimal price "السعر"
    }`,
    en: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ ORDER_ITEM : contains
    PRODUCT ||--o{ ORDER_ITEM : "appears in"
    CUSTOMER {
        int id PK
        string name "Full name"
        string email UK "Email address"
    }
    ORDER {
        int id PK
        int customer_id FK
        date created_at "Order date"
        string status
    }
    ORDER_ITEM {
        int order_id FK
        int product_id FK
        int quantity
    }
    PRODUCT {
        int id PK
        string title "Product name"
        decimal price
    }` } },

  { key: 'gantt', group: 'grpPlanning', kw: 'gantt', name: { ar: 'مخطط جانت', en: 'Gantt' }, code: {
    ar: `gantt
    title خطة إطلاق التطبيق
    dateFormat YYYY-MM-DD
    axisFormat %d/%m
    excludes weekends
    weekend friday
    section التخطيط
    تحليل المتطلبات   :done, req, 2026-10-01, 5d
    تصميم الواجهات    :active, ui, after req, 7d
    section التطوير
    الواجهة الخلفية   :be, after req, 12d
    الواجهة الأمامية  :fe, after ui, 10d
    section الإطلاق
    الاختبار          :crit, qa, after fe, 5d
    الإطلاق           :milestone, launch, after qa, 0d`,
    en: `gantt
    title App launch plan
    dateFormat YYYY-MM-DD
    axisFormat %b %d
    excludes weekends
    section Planning
    Requirements analysis :done, req, 2026-10-01, 5d
    UI design             :active, ui, after req, 7d
    section Development
    Backend               :be, after req, 12d
    Frontend              :fe, after ui, 10d
    section Launch
    Testing               :crit, qa, after fe, 5d
    Release               :milestone, launch, after qa, 0d` } },

  { key: 'timeline', group: 'grpPlanning', kw: 'timeline', name: { ar: 'خط زمني', en: 'Timeline' }, code: {
    ar: `timeline
    title محطات في تاريخ الويب
    1991 : أول موقع ويب
    1995 : ظهور JavaScript
         : تأسيس أمازون وإيباي
    2004 : فيسبوك
    2007 : أول آيفون
    2015 : معيار ES6
    2022 : نماذج الذكاء الاصطناعي التوليدي`,
    en: `timeline
    title Milestones of the web
    1991 : First website
    1995 : JavaScript is born
         : Amazon and eBay are founded
    2004 : Facebook
    2007 : First iPhone
    2015 : ES6 standard
    2022 : Generative AI models` } },

  { key: 'kanban', group: 'grpPlanning', kw: 'kanban', name: { ar: 'لوحة كانبان', en: 'Kanban board' }, code: {
    ar: `kanban
  todo[للتنفيذ]
    t1[تصميم صفحة الهبوط]
    t2[كتابة توثيق API]
  doing[قيد العمل]
    t3[دعم الوضع الداكن]@{ assigned: 'سارة', priority: 'High' }
  review[مراجعة]
    t4[إصلاح خلل التصدير]@{ priority: 'Low' }
  done[مكتمل]
    t5[إعداد التكامل المستمر]`,
    en: `kanban
  todo[To do]
    t1[Design the landing page]
    t2[Write the API docs]
  doing[In progress]
    t3[Dark mode support]@{ assigned: 'Sara', priority: 'High' }
  review[Review]
    t4[Fix the export bug]@{ priority: 'Low' }
  done[Done]
    t5[Set up CI]` } },

  { key: 'journey', group: 'grpPlanning', kw: 'journey', name: { ar: 'رحلة المستخدم', en: 'User journey' }, code: {
    ar: `journey
    title رحلة شراء عبر الإنترنت
    section الاكتشاف
      البحث عن المنتج: 4: العميل
      مقارنة الأسعار: 3: العميل
    section الشراء
      إضافة إلى السلة: 5: العميل
      الدفع: 2: العميل, البنك
    section ما بعد الشراء
      تتبع الشحنة: 3: العميل, شركة الشحن
      استلام الطلب: 5: العميل`,
    en: `journey
    title Online shopping journey
    section Discover
      Search for a product: 4: Customer
      Compare prices: 3: Customer
    section Purchase
      Add to cart: 5: Customer
      Pay: 2: Customer, Bank
    section After purchase
      Track the shipment: 3: Customer, Courier
      Receive the order: 5: Customer` } },

  { key: 'gitGraph', group: 'grpPlanning', kw: 'gitGraph', name: { ar: 'تفرعات Git', en: 'Git branches' }, code: {
    ar: `gitGraph
    commit id: "البداية"
    branch develop
    checkout develop
    commit id: "إعداد المشروع"
    branch feature/login
    checkout feature/login
    commit id: "صفحة الدخول"
    commit id: "اختبارات الدخول"
    checkout develop
    merge feature/login
    checkout main
    merge develop tag: "v1.0"
    commit id: "إصلاح عاجل"`,
    en: `gitGraph
    commit id: "Initial"
    branch develop
    checkout develop
    commit id: "Project setup"
    branch feature/login
    checkout feature/login
    commit id: "Login page"
    commit id: "Login tests"
    checkout develop
    merge feature/login
    checkout main
    merge develop tag: "v1.0"
    commit id: "Hotfix"` } },

  { key: 'requirement', group: 'grpPlanning', kw: 'requirementDiagram', name: { ar: 'المتطلبات', en: 'Requirements' }, code: {
    ar: `requirementDiagram
    requirement login_req {
        id: 1
        text: "دعم تسجيل دخول آمن"
        risk: high
        verifymethod: test
    }
    functionalRequirement twofa_req {
        id: 1.1
        text: "التحقق بخطوتين"
        risk: medium
        verifymethod: demonstration
    }
    element auth_service {
        type: "خدمة المصادقة"
        docref: "docs/auth.md"
    }
    login_req - contains -> twofa_req
    auth_service - satisfies -> login_req`,
    en: `requirementDiagram
    requirement login_req {
        id: 1
        text: "Support secure sign-in"
        risk: high
        verifymethod: test
    }
    functionalRequirement twofa_req {
        id: 1.1
        text: "Two-factor verification"
        risk: medium
        verifymethod: demonstration
    }
    element auth_service {
        type: "Auth service"
        docref: "docs/auth.md"
    }
    login_req - contains -> twofa_req
    auth_service - satisfies -> login_req` } },

  { key: 'pie', group: 'grpData', kw: 'pie', name: { ar: 'مخطط دائري', en: 'Pie chart' }, code: {
    ar: `pie showData
    title مصادر الزيارات
    "بحث عضوي" : 42.5
    "وسائل التواصل" : 27
    "زيارات مباشرة" : 18
    "إحالات" : 12.5`,
    en: `pie showData
    title Traffic sources
    "Organic search" : 42.5
    "Social media" : 27
    "Direct" : 18
    "Referrals" : 12.5` } },

  { key: 'xychart', group: 'grpData', kw: 'xychart', name: { ar: 'أعمدة وخطوط', en: 'Bars & lines' }, code: {
    ar: `xychart
    title "المبيعات الشهرية (بالألف)"
    x-axis ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو"]
    y-axis "الإيرادات" 0 --> 120
    bar [52, 60, 75, 68, 90, 105]
    line [52, 60, 75, 68, 90, 105]`,
    en: `xychart
    title "Monthly sales (thousands)"
    x-axis [Jan, Feb, Mar, Apr, May, Jun]
    y-axis "Revenue" 0 --> 120
    bar [52, 60, 75, 68, 90, 105]
    line [52, 60, 75, 68, 90, 105]` } },

  { key: 'quadrant', group: 'grpData', kw: 'quadrantChart', name: { ar: 'مصفوفة الأولويات', en: 'Priority matrix' }, code: {
    ar: `quadrantChart
    title مصفوفة أولويات المهام
    x-axis "جهد منخفض" --> "جهد مرتفع"
    y-axis "أثر منخفض" --> "أثر مرتفع"
    quadrant-1 "مشاريع كبرى"
    quadrant-2 "مكاسب سريعة"
    quadrant-3 "مهام ثانوية"
    quadrant-4 "تجنّبها"
    "تحسين الأداء": [0.25, 0.85]
    "إعادة التصميم": [0.8, 0.9]
    "تحديث الشعار": [0.2, 0.25]
    "نظام التقارير": [0.75, 0.3]`,
    en: `quadrantChart
    title Task priority matrix
    x-axis Low effort --> High effort
    y-axis Low impact --> High impact
    quadrant-1 Major projects
    quadrant-2 Quick wins
    quadrant-3 Fill-ins
    quadrant-4 Avoid
    Performance tuning: [0.25, 0.85]
    Redesign: [0.8, 0.9]
    Logo refresh: [0.2, 0.25]
    Reporting system: [0.75, 0.3]` } },

  { key: 'sankey', group: 'grpData', kw: 'sankey', name: { ar: 'مخطط سانكي', en: 'Sankey' }, code: {
    ar: `---
title: توزيع الميزانية الشهرية
---
sankey
%% ملاحظة: محلّل سانكي في Mermaid لا يقبل الحروف العربية في أسماء العقد حاليًا

Salary,Income,4500
Freelance,Income,1500
Income,Housing,1800
Income,Food,900
Income,Transport,450
Income,Savings,1600
Income,Leisure,550
Income,Other,700`,
    en: `---
title: Monthly budget
---
sankey

Salary,Income,4500
Freelance,Income,1500
Income,Housing,1800
Income,Food,900
Income,Transport,450
Income,Savings,1600
Income,Leisure,550
Income,Other,700` } },

  { key: 'radar', group: 'grpData', kw: 'radar-beta', name: { ar: 'مخطط راداري', en: 'Radar' }, code: {
    ar: `---
title: "مهارات الفريق"
---
radar-beta
  axis fe["الواجهة"], be["الخادم"], ux["التصميم"]
  axis ops["العمليات"], qa["الاختبار"], sec["الأمان"]
  curve a["فريق أ"]{80, 70, 90, 60, 75, 65}
  curve b["فريق ب"]{65, 90, 55, 85, 70, 80}
  max 100
  min 0`,
    en: `---
title: "Team skills"
---
radar-beta
  axis fe["Frontend"], be["Backend"], ux["Design"]
  axis ops["Operations"], qa["Testing"], sec["Security"]
  curve a["Team A"]{80, 70, 90, 60, 75, 65}
  curve b["Team B"]{65, 90, 55, 85, 70, 80}
  max 100
  min 0` } },

  { key: 'treemap', group: 'grpData', kw: 'treemap-beta', name: { ar: 'خريطة شجرية', en: 'Treemap' }, code: {
    ar: `treemap-beta
"الميزانية"
    "التسويق"
        "إعلانات": 30
        "فعاليات": 15
    "التطوير"
        "رواتب": 55
        "خوادم": 20
    "الإدارة": 18`,
    en: `treemap-beta
"Budget"
    "Marketing"
        "Ads": 30
        "Events": 15
    "Engineering"
        "Salaries": 55
        "Servers": 20
    "Admin": 18` } },

  { key: 'venn', group: 'grpData', kw: 'venn-beta', name: { ar: 'مخطط فِن', en: 'Venn' }, code: {
    ar: `venn-beta
  title ما الذي يصنع منتجًا ناجحًا
  set Desirable
  set Feasible
  set Viable
  union Desirable,Feasible["قابل للبناء"]
  union Feasible,Viable["مستدام"]
  union Desirable,Viable["قابل للتسويق"]
  union Desirable,Feasible,Viable["أطلِقه!"]`,
    en: `venn-beta
  title What makes a good product
  set Desirable
  set Feasible
  set Viable
  union Desirable,Feasible["Buildable"]
  union Feasible,Viable["Sustainable"]
  union Desirable,Viable["Marketable"]
  union Desirable,Feasible,Viable["Ship it!"]` } },

  { key: 'packet', group: 'grpData', kw: 'packet', name: { ar: 'بنية حزمة', en: 'Packet layout' }, code: {
    ar: `---
title: "ترويسة UDP"
---
packet
0-15: "منفذ المصدر"
16-31: "منفذ الوجهة"
32-47: "الطول"
48-63: "المجموع الاختباري"
64-95: "البيانات (طول متغير)"`,
    en: `---
title: "UDP header"
---
packet
0-15: "Source port"
16-31: "Destination port"
32-47: "Length"
48-63: "Checksum"
64-95: "Data (variable length)"` } },

  { key: 'mindmap', group: 'grpStructure', kw: 'mindmap', name: { ar: 'خريطة ذهنية', en: 'Mind map' }, code: {
    ar: `mindmap
  root((مشروع المتجر))
    الواجهة
      تصميم متجاوب
      دعم الاتجاه من اليمين
    الخادم
      واجهة REST
      قاعدة البيانات
        PostgreSQL
        Redis
    التسويق
      حملات البريد
      تحسين محركات البحث
    الفريق
      مطوّرون
      مصممون`,
    en: `mindmap
  root((Store project))
    Frontend
      Responsive design
      Right-to-left support
    Backend
      REST API
      Database
        PostgreSQL
        Redis
    Marketing
      Email campaigns
      Search optimization
    Team
      Developers
      Designers` } },

  { key: 'architecture', group: 'grpStructure', kw: 'architecture-beta', name: { ar: 'معمارية سحابية', en: 'Cloud architecture' }, code: {
    ar: `architecture-beta
    group cloud(cloud)[السحابة]

    service api(server)[خادم API] in cloud
    service db(database)[قاعدة البيانات] in cloud
    service disk(disk)[التخزين] in cloud
    service gw(internet)[البوابة]

    gw:R --> L:api
    api:R -- L:db
    api:B -- T:disk`,
    en: `architecture-beta
    group cloud(cloud)[Cloud]

    service api(server)[API server] in cloud
    service db(database)[Database] in cloud
    service disk(disk)[Storage] in cloud
    service gw(internet)[Gateway]

    gw:R --> L:api
    api:R -- L:db
    api:B -- T:disk` } },

  { key: 'block', group: 'grpStructure', kw: 'block', name: { ar: 'مخطط كتل', en: 'Block diagram' }, code: {
    ar: `block
  columns 3
  ui["الواجهة الأمامية"]:3
  api["بوابة API"] auth["المصادقة"] cache[("ذاكرة Redis")]
  space:3
  db[("قاعدة البيانات")]:3
  ui --> api
  api --> db
  auth --> db`,
    en: `block
  columns 3
  ui["Frontend"]:3
  api["API gateway"] auth["Auth"] cache[("Redis cache")]
  space:3
  db[("Database")]:3
  ui --> api
  api --> db
  auth --> db` } },

  { key: 'c4', group: 'grpStructure', kw: 'C4Context', name: { ar: 'سياق C4', en: 'C4 context' }, code: {
    ar: `C4Context
    title نظام الخدمات المصرفية
    Person(customer, "العميل", "عميل لدى البنك")
    System(banking, "الخدمات المصرفية الرقمية", "عرض الحسابات وتنفيذ المدفوعات")
    System_Ext(mail, "نظام البريد", "خادم البريد الداخلي")
    System_Ext(core, "النظام المصرفي الأساسي", "يخزن بيانات الحسابات")
    Rel(customer, banking, "يستخدم")
    Rel(banking, mail, "يرسل رسائل عبر")
    Rel(banking, core, "يقرأ ويكتب")
    Rel(mail, customer, "يرسل رسائل إلى")`,
    en: `C4Context
    title Internet banking system
    Person(customer, "Customer", "A bank customer")
    System(banking, "Digital banking", "View accounts and make payments")
    System_Ext(mail, "Email system", "Internal mail server")
    System_Ext(core, "Core banking", "Stores account data")
    Rel(customer, banking, "Uses")
    Rel(banking, mail, "Sends email via")
    Rel(banking, core, "Reads and writes")
    Rel(mail, customer, "Sends email to")` } },

  { key: 'ishikawa', group: 'grpStructure', kw: 'ishikawa-beta', name: { ar: 'هيكل السمكة', en: 'Fishbone' }, code: {
    ar: `ishikawa-beta
    تأخر تسليم الطلبات
    الأفراد
        نقص التدريب
        ضغط العمل
    العمليات
        خطوات موافقة كثيرة
        غياب الأتمتة
    الأدوات
        نظام مخزون قديم
            بطء التحديث
            أخطاء المزامنة
    البيئة
        ازدحام مواسم الذروة`,
    en: `ishikawa-beta
    Late order delivery
    People
        Lack of training
        Heavy workload
    Process
        Too many approval steps
        No automation
    Tools
        Legacy inventory system
            Slow updates
            Sync errors
    Environment
        Peak season congestion` } },

  { key: 'treeView', group: 'grpStructure', kw: 'treeView-beta', name: { ar: 'شجرة ملفات', en: 'File tree' }, code:
`treeView-beta
├── src/
│   ├── components/
│   │   ├── Editor.tsx
│   │   └── Preview.tsx
│   ├── i18n/
│   │   └── ar.json
│   └── main.ts
├── public/
│   └── index.html
├── package.json
└── README.md` },

  { key: 'swimlane', group: 'grpStructure', kw: 'swimlane-beta', name: { ar: 'مسارات العمل', en: 'Swimlanes' }, code: {
    ar: `swimlane-beta LR
  subgraph customer [العميل]
    browse[تصفح المنتجات]
    pay[الدفع]
  end
  subgraph warehouse [المستودع]
    pick[تجهيز الطلب]
    ship[الشحن]
  end
  subgraph finance [المالية]
    invoice[إصدار الفاتورة]
  end
  browse --> pay
  pay --> pick
  pick --> ship
  pay --> invoice`,
    en: `swimlane-beta LR
  subgraph customer [Customer]
    browse[Browse products]
    pay[Pay]
  end
  subgraph warehouse [Warehouse]
    pick[Pick the order]
    ship[Ship]
  end
  subgraph finance [Finance]
    invoice[Issue invoice]
  end
  browse --> pay
  pay --> pick
  pick --> ship
  pay --> invoice` } },

  { key: 'usecase', group: 'grpStructure', kw: 'usecase-beta', name: { ar: 'حالات الاستخدام', en: 'Use cases' }, code: {
    ar: `usecase-beta
direction LR
actor Customer("العميل")
actor Admin("مدير المتجر")
systemBoundary "نظام الطلبات"
  Browse("تصفح المنتجات")
  Checkout("إتمام الشراء")
  Manage("إدارة المخزون")
end
Customer --> Browse
Customer --> Checkout
Admin --> Manage`,
    en: `usecase-beta
direction LR
actor Customer("Customer")
actor Admin("Store manager")
systemBoundary "Ordering system"
  Browse("Browse products")
  Checkout("Check out")
  Manage("Manage inventory")
end
Customer --> Browse
Customer --> Checkout
Admin --> Manage` } },

  { key: 'wardley', group: 'grpStructure', kw: 'wardley-beta', name: { ar: 'خريطة وردلي', en: 'Wardley map' }, code: {
    ar: `wardley-beta
title سلسلة قيمة متجر الشاي

anchor Business [0.95, 0.63]
component Cup of Tea [0.79, 0.61]
component Tea [0.63, 0.81]
component Hot Water [0.52, 0.80]
component Kettle [0.43, 0.35]
component Power [0.10, 0.70]

Business -> Cup of Tea
Cup of Tea -> Tea
Cup of Tea -> Hot Water
Hot Water -> Kettle
Kettle -> Power

evolve Kettle 0.62
evolve Power 0.89

note "توحيد مصادر الطاقة يسرّع تطور الغلايات" [0.30, 0.49]`,
    en: `wardley-beta
title Tea shop value chain

anchor Business [0.95, 0.63]
component Cup of Tea [0.79, 0.61]
component Tea [0.63, 0.81]
component Hot Water [0.52, 0.80]
component Kettle [0.43, 0.35]
component Power [0.10, 0.70]

Business -> Cup of Tea
Cup of Tea -> Tea
Cup of Tea -> Hot Water
Hot Water -> Kettle
Kettle -> Power

evolve Kettle 0.62
evolve Power 0.89

note "Standardising power lets kettles evolve faster" [0.30, 0.49]` } },

  { key: 'cynefin', group: 'grpStructure', kw: 'cynefin-beta', name: { ar: 'إطار كينيفين', en: 'Cynefin' }, code: {
    ar: `cynefin-beta
  title الاستجابة للحوادث

  complex
    "تحليل السبب الجذري"
    "تجارب هندسة الفوضى"

  complicated
    "تحليل بيانات الأداء"
    "مراجعة خبير"

  clear
    "إعادة تشغيل الخدمة"
    "تطبيق إصلاح معروف"

  chaotic
    "استدعاء المناوب فورًا"

  confusion
    "نمط عطل غير معروف"`,
    en: `cynefin-beta
  title Incident response

  complex
    "Investigate the root cause"
    "Run a chaos experiment"

  complicated
    "Analyze performance data"
    "Expert review"

  clear
    "Restart the service"
    "Apply a known fix"

  chaotic
    "Page on-call immediately"

  confusion
    "Unknown failure mode"` } },

  { key: 'railroad', group: 'grpStructure', kw: 'railroad-ebnf-beta', name: { ar: 'قواعد النحو (EBNF)', en: 'Grammar (EBNF)' }, code: {
    ar: `railroad-ebnf-beta
title "تعريف العدد"

number = [ "-" ] , digit , { digit } ;
digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" ;`,
    en: `railroad-ebnf-beta
title "Number definition"

number = [ "-" ] , digit , { digit } ;
digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" ;` } },
];

// First-run diagrams, in the interface language at first launch.
const MARSAM_SEEDS = [
  { tpl: 'flowchart', name: { ar: 'مسار طلب الشراء', en: 'Order checkout flow' }, age: 0 },
  { tpl: 'sequence', name: { ar: 'تسجيل الدخول', en: 'Sign-in' }, age: 36e5 * 3 },
  { tpl: 'gantt', name: { ar: 'خطة إطلاق التطبيق', en: 'App launch plan' }, age: 864e5 * 2 },
];

// [keyword pattern, label, snippet group]
const MARSAM_TYPES = [
  [/^(flowchart-elk|flowchart|graph)$/, { ar: 'مخطط انسيابي', en: 'Flowchart' }, 'flowchart'],
  [/^sequenceDiagram$/, { ar: 'مخطط تسلسلي', en: 'Sequence diagram' }, 'sequence'],
  [/^classDiagram(-v2)?$/, { ar: 'مخطط الأصناف', en: 'Class diagram' }, 'class'],
  [/^stateDiagram(-v2)?$/, { ar: 'مخطط الحالات', en: 'State diagram' }, 'state'],
  [/^erDiagram$/, { ar: 'الكيانات والعلاقات', en: 'Entity relationship' }, 'er'],
  [/^gantt$/, { ar: 'مخطط جانت', en: 'Gantt chart' }, 'gantt'],
  [/^pie$/, { ar: 'مخطط دائري', en: 'Pie chart' }, 'pie'],
  [/^mindmap$/, { ar: 'خريطة ذهنية', en: 'Mind map' }, 'mindmap'],
  [/^timeline$/, { ar: 'خط زمني', en: 'Timeline' }, 'timeline'],
  [/^journey$/, { ar: 'رحلة المستخدم', en: 'User journey' }, 'journey'],
  [/^gitGraph$/, { ar: 'تفرعات Git', en: 'Git graph' }, 'gitGraph'],
  [/^quadrantChart$/, { ar: 'مصفوفة رباعية', en: 'Quadrant chart' }, null],
  [/^xychart(-beta)?$/, { ar: 'مخطط XY', en: 'XY chart' }, 'xychart'],
  [/^sankey(-beta)?$/, { ar: 'مخطط سانكي', en: 'Sankey diagram' }, null],
  [/^block(-beta)?$/, { ar: 'مخطط كتل', en: 'Block diagram' }, 'block'],
  [/^architecture(-beta)?$/, { ar: 'مخطط معماري', en: 'Architecture diagram' }, 'architecture'],
  [/^C4(Context|Container|Component|Dynamic|Deployment)$/, { ar: 'مخطط C4', en: 'C4 diagram' }, 'c4'],
  [/^kanban$/, { ar: 'لوحة كانبان', en: 'Kanban board' }, 'kanban'],
  [/^packet(-beta)?$/, { ar: 'بنية حزمة', en: 'Packet diagram' }, null],
  [/^requirement(Diagram)?$/, { ar: 'مخطط المتطلبات', en: 'Requirement diagram' }, null],
  [/^radar-beta$/, { ar: 'مخطط راداري', en: 'Radar chart' }, null],
  [/^treemap(-beta)?$/, { ar: 'خريطة شجرية', en: 'Treemap' }, null],
  [/^venn-beta$/, { ar: 'مخطط فِن', en: 'Venn diagram' }, null],
  [/^ishikawa(-beta)?$/i, { ar: 'هيكل السمكة', en: 'Fishbone diagram' }, null],
  [/^treeView-beta$/, { ar: 'شجرة ملفات', en: 'File tree' }, null],
  [/^wardley-beta$/i, { ar: 'خريطة وردلي', en: 'Wardley map' }, null],
  [/^usecase-beta$/, { ar: 'حالات الاستخدام', en: 'Use case diagram' }, null],
  [/^swimlane-beta$/, { ar: 'مسارات العمل', en: 'Swimlanes' }, 'flowchart'],
  [/^cynefin-beta$/, { ar: 'إطار كينيفين', en: 'Cynefin framework' }, null],
  [/^railroad(-abnf|-ebnf|-peg)?-beta$/i, { ar: 'مخطط قواعد النحو', en: 'Railroad grammar' }, null],
  [/^eventmodeling$/, { ar: 'نمذجة الأحداث', en: 'Event modeling' }, null],
  [/^agentflow-beta$/, { ar: 'تدفق الوكلاء', en: 'Agent flow' }, 'flowchart'],
  [/^zenuml$/, { ar: 'ZenUML (غير مضمَّن)', en: 'ZenUML (not bundled)' }, null],
  [/^info$/, { ar: 'معلومات Mermaid', en: 'Mermaid info' }, null],
];
const MARSAM_HEAD_RE = /^(flowchart-elk|flowchart|graph|sequenceDiagram|classDiagram-v2|classDiagram|stateDiagram-v2|stateDiagram|erDiagram|journey|gantt|pie|quadrantChart|requirementDiagram|requirement|gitGraph|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|mindmap|timeline|zenuml|sankey-beta|sankey|xychart-beta|xychart|block-beta|block|packet-beta|packet|kanban|architecture-beta|architecture|radar-beta|treemap-beta|treemap|venn-beta|ishikawa-beta|ishikawa|treeView-beta|wardley-beta|usecase-beta|swimlane-beta|cynefin-beta|railroad-abnf-beta|railroad-ebnf-beta|railroad-peg-beta|railroad-beta|eventmodeling|agentflow-beta|info)(?![\w-])/;

// Snippets: l = label, c = code, top = insert at the top of the file.
const S = (ar, en, c, top) => ({ l: { ar, en }, c, top });
const MARSAM_SNIPPETS = {
  flowchart: [
    S('عقدة مستطيلة', 'Rectangle node', { ar: 'id1[نص العقدة]', en: 'id1[Node text]' }),
    S('حواف دائرية', 'Rounded node', { ar: 'id2(نص العقدة)', en: 'id2(Node text)' }),
    S('شكل كبسولة', 'Stadium', { ar: 'id3([بداية])', en: 'id3([Start])' }),
    S('قرار', 'Decision', { ar: 'id4{سؤال؟}', en: 'id4{Question?}' }),
    S('قاعدة بيانات', 'Database', { ar: 'id5[(البيانات)]', en: 'id5[(Data)]' }),
    S('دائرة', 'Circle', { ar: 'id6((نص))', en: 'id6((Text))' }),
    S('سداسي', 'Hexagon', { ar: 'id7{{تحضير}}', en: 'id7{{Prepare}}' }),
    S('مدخلات / مخرجات', 'Input / output', { ar: 'id8[/إدخال/]', en: 'id8[/Input/]' }),
    S('شكل موسّع (v11+)', 'Extended shape (v11+)', { ar: 'id9@{ shape: doc, label: "مستند" }', en: 'id9@{ shape: doc, label: "Document" }' }),
    S('سهم بعنوان', 'Labelled arrow', { ar: 'A -->|نص| B', en: 'A -->|label| B' }),
    S('رابط منقّط', 'Dotted link', 'A -.-> B'),
    S('رابط سميك', 'Thick link', 'A ==> B'),
    S('رابط باتجاهين', 'Two-way link', 'A <--> B'),
    S('مجموعة فرعية', 'Subgraph', { ar: 'subgraph group1 [عنوان المجموعة]\n    direction LR\n    X --> Y\nend', en: 'subgraph group1 [Group title]\n    direction LR\n    X --> Y\nend' }),
    S('صنف تنسيق', 'Style class', 'classDef highlight fill:#FDE68A,stroke:#B45309,color:#1F2937\nclass A highlight'),
    S('تنسيق عقدة', 'Node style', 'style A fill:#E0E7FF,stroke:#4338CA,stroke-width:2px'),
    S('تنسيق رابط', 'Link style', 'linkStyle 0 stroke:#DC2626,stroke-width:2px'),
    S('رابط تشعبي', 'Hyperlink', 'click A "https://mermaid.js.org" _blank'),
  ],
  sequence: [
    S('مشارك', 'Participant', { ar: 'participant S as الخادم', en: 'participant S as Server' }),
    S('ممثل (شخص)', 'Actor (person)', { ar: 'actor U as المستخدم', en: 'actor U as User' }),
    S('رسالة متزامنة', 'Synchronous message', { ar: 'U->>S: طلب', en: 'U->>S: Request' }),
    S('رد', 'Reply', { ar: 'S-->>U: استجابة', en: 'S-->>U: Response' }),
    S('رسالة غير متزامنة', 'Async message', { ar: 'U-)S: إشعار', en: 'U-)S: Notify' }),
    S('ملاحظة', 'Note', { ar: 'Note right of S: ملاحظة', en: 'Note right of S: A note' }),
    S('تكرار', 'Loop', { ar: 'loop كل دقيقة\n    U->>S: فحص الحالة\nend', en: 'loop Every minute\n    U->>S: Check status\nend' }),
    S('بدائل', 'Alternatives', { ar: 'alt نجاح\n    S-->>U: 200\nelse فشل\n    S-->>U: 500\nend', en: 'alt Success\n    S-->>U: 200\nelse Failure\n    S-->>U: 500\nend' }),
    S('اختياري', 'Optional', { ar: 'opt عند الحاجة\n    S->>S: تسجيل\nend', en: 'opt When needed\n    S->>S: Log\nend' }),
    S('متوازي', 'Parallel', { ar: 'par إرسال بريد\n    S->>U: بريد\nand إرسال رسالة\n    S->>U: SMS\nend', en: 'par Send email\n    S->>U: Email\nand Send text\n    S->>U: SMS\nend' }),
    S('تفعيل وإيقاف', 'Activation', { ar: 'activate S\nS-->>U: جارٍ\ndeactivate S', en: 'activate S\nS-->>U: Working\ndeactivate S' }),
    S('ترقيم تلقائي', 'Autonumber', 'autonumber'),
    S('منطقة ملوّنة', 'Highlighted region', { ar: 'rect rgb(231, 236, 252)\n    U->>S: طلب\nend', en: 'rect rgb(231, 236, 252)\n    U->>S: Request\nend' }),
  ],
  class: [
    S('صنف', 'Class', { ar: 'class Order["الطلب"] {\n    +int id\n    +Date createdAt\n    +total() Decimal\n}', en: 'class Order {\n    +int id\n    +Date createdAt\n    +total() Decimal\n}' }),
    S('وراثة', 'Inheritance', 'Base <|-- Derived'),
    S('تركيب', 'Composition', 'Whole *-- Part'),
    S('تجميع', 'Aggregation', 'Group o-- Member'),
    S('ارتباط', 'Association', { ar: 'A --> B : يستخدم', en: 'A --> B : uses' }),
    S('اعتماد', 'Dependency', 'A ..> B'),
    S('تحقيق واجهة', 'Realization', 'Impl ..|> Contract'),
    S('واجهة', 'Interface', 'class Shape {\n    <<interface>>\n    +area() float\n}'),
    S('تعدد العلاقة', 'Cardinality', 'Customer "1" --> "*" Order'),
    S('ملاحظة', 'Note', { ar: 'note for Order "ملاحظة على الصنف"', en: 'note for Order "A note about the class"' }),
  ],
  state: [
    S('حالة بوصف', 'State with description', { ar: 'Idle: خامل', en: 'Idle: Waiting' }),
    S('انتقال', 'Transition', { ar: 'Idle --> Running: بدء', en: 'Idle --> Running: start' }),
    S('بداية ونهاية', 'Start and end', '[*] --> Idle\nDone --> [*]'),
    S('حالة مركّبة', 'Composite state', 'state Running {\n    [*] --> Loading\n    Loading --> Ready\n}'),
    S('اختيار', 'Choice', { ar: 'state check <<choice>>\nRunning --> check\ncheck --> Done: نجاح\ncheck --> Failed: فشل', en: 'state check <<choice>>\nRunning --> check\ncheck --> Done: ok\ncheck --> Failed: error' }),
    S('تفرّع ودمج', 'Fork and join', 'state fork1 <<fork>>\nstate join1 <<join>>\n[*] --> fork1\nfork1 --> A\nfork1 --> B\nA --> join1\nB --> join1'),
    S('ملاحظة', 'Note', { ar: 'note right of Idle\n    ملاحظة\nend note', en: 'note right of Idle\n    A note\nend note' }),
  ],
  er: [
    S('كيان', 'Entity', { ar: 'ENTITY {\n    int id PK\n    string name "الاسم"\n}', en: 'ENTITY {\n    int id PK\n    string name\n}' }),
    S('واحد إلى متعدد', 'One to many', { ar: 'A ||--o{ B : "يملك"', en: 'A ||--o{ B : owns' }),
    S('واحد إلى واحد', 'One to one', { ar: 'A ||--|| B : "يرتبط"', en: 'A ||--|| B : "is linked to"' }),
    S('متعدد إلى متعدد', 'Many to many', { ar: 'A }o--o{ B : "يشارك"', en: 'A }o--o{ B : shares' }),
    S('علاقة غير معرِّفة', 'Non-identifying', { ar: 'A ||..o{ B : "يشير إلى"', en: 'A ||..o{ B : "refers to"' }),
  ],
  gantt: [
    S('قسم', 'Section', { ar: 'section قسم جديد', en: 'section New section' }),
    S('مهمة', 'Task', { ar: 'مهمة جديدة :task1, 2026-10-01, 3d', en: 'New task :task1, 2026-10-01, 3d' }),
    S('مهمة تالية', 'Follow-up task', { ar: 'مهمة لاحقة :task2, after task1, 5d', en: 'Next task :task2, after task1, 5d' }),
    S('مهمة حرجة', 'Critical task', { ar: 'مهمة حرجة :crit, task3, after task2, 2d', en: 'Critical task :crit, task3, after task2, 2d' }),
    S('معلم', 'Milestone', { ar: 'تسليم :milestone, m1, after task3, 0d', en: 'Delivery :milestone, m1, after task3, 0d' }),
    S('عطلة الجمعة والسبت', 'Friday–Saturday weekend', 'excludes weekends\nweekend friday'),
  ],
  mindmap: [
    S('جذر دائري', 'Round root', { ar: 'root((الفكرة))', en: 'root((Idea))' }),
    S('فرع مربع', 'Square branch', { ar: '[فرع]', en: '[Branch]' }),
    S('فرع دائري الحواف', 'Rounded branch', { ar: '(فرع)', en: '(Branch)' }),
    S('سحابة', 'Cloud', { ar: ')سحابة(', en: ')Cloud(' }),
    S('سداسي', 'Hexagon', { ar: '{{فكرة}}', en: '{{Idea}}' }),
  ],
  gitGraph: [
    S('إيداع', 'Commit', { ar: 'commit id: "وصف"', en: 'commit id: "Description"' }),
    S('فرع جديد', 'New branch', 'branch feature\ncheckout feature'),
    S('دمج', 'Merge', 'checkout main\nmerge feature'),
    S('وسم', 'Tag', 'commit tag: "v1.1"'),
    S('انتقاء إيداع', 'Cherry-pick', { ar: 'cherry-pick id: "وصف"', en: 'cherry-pick id: "Description"' }),
  ],
  pie: [S('شريحة', 'Slice', { ar: '"اسم الشريحة" : 25', en: '"Slice name" : 25' })],
  timeline: [
    S('فترة', 'Period', { ar: '2026 : حدث\n     : حدث آخر', en: '2026 : Event\n     : Another event' }),
    S('قسم', 'Section', { ar: 'section المرحلة الأولى', en: 'section Phase one' }),
  ],
  journey: [
    S('قسم', 'Section', { ar: 'section مرحلة', en: 'section Stage' }),
    S('خطوة', 'Step', { ar: 'خطوة جديدة: 4: العميل', en: 'New step: 4: Customer' }),
  ],
  xychart: [S('أعمدة', 'Bars', 'bar [10, 20, 30]'), S('خط', 'Line', 'line [10, 20, 30]')],
  kanban: [
    S('عمود', 'Column', { ar: 'col[اسم العمود]', en: 'col[Column name]' }),
    S('بطاقة', 'Card', { ar: "  card[مهمة]@{ assigned: 'علي', priority: 'High' }", en: "  card[Task]@{ assigned: 'Ali', priority: 'High' }" }),
  ],
  block: [
    S('أعمدة', 'Columns', 'columns 3'),
    S('كتلة عريضة', 'Wide block', { ar: 'wide["كتلة"]:2', en: 'wide["Block"]:2' }),
    S('فراغ', 'Space', 'space'),
    S('رابط', 'Link', 'a --> b'),
  ],
  architecture: [
    S('مجموعة', 'Group', { ar: 'group grp(cloud)[مجموعة]', en: 'group grp(cloud)[Group]' }),
    S('خدمة', 'Service', { ar: 'service svc(server)[خدمة] in grp', en: 'service svc(server)[Service] in grp' }),
    S('رابط', 'Link', 'a:R --> L:b'),
  ],
  c4: [
    S('شخص', 'Person', { ar: 'Person(p, "الاسم", "الوصف")', en: 'Person(p, "Name", "Description")' }),
    S('نظام', 'System', { ar: 'System(s, "النظام", "الوصف")', en: 'System(s, "System", "Description")' }),
    S('علاقة', 'Relationship', { ar: 'Rel(p, s, "يستخدم")', en: 'Rel(p, s, "Uses")' }),
  ],
  common: [
    S('تعليق', 'Comment', { ar: '%% تعليق لا يظهر في المخطط', en: '%% A comment that is not drawn' }),
    S('إعدادات في رأس الملف', 'Front-matter settings', { ar: '---\ntitle: عنوان المخطط\nconfig:\n  theme: neutral\n  look: handDrawn\n  layout: dagre\n---', en: '---\ntitle: Diagram title\nconfig:\n  theme: neutral\n  look: handDrawn\n  layout: dagre\n---' }, true),
    S('وصف لقارئات الشاشة', 'Screen-reader description', { ar: 'accTitle: عنوان مختصر\naccDescr: وصف المخطط لقارئات الشاشة', en: 'accTitle: Short title\naccDescr: Description of the diagram for screen readers' }),
  ],
};
