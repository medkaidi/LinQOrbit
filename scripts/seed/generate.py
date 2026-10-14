#!/usr/bin/env python3
"""Deterministic dev-seed generator for LinQOrbit.

SIMULATION ONLY — never a Flyway migration. Emits a standalone seed.sql that
populates ~100 candidate users (7/7 profiles) and ~100 job offers across
15 recruiters/companies, including normalized_profile JSONB (candidate v2,
offer v1) + DONE normalization jobs, so matching/screening can run without
any LLM call. Everything derives from 15 job archetypes + name pools and a
fixed RNG seed: reruns are reproducible, and --down emits the cleanup.

Usage:
  python scripts/seed/generate.py > seed.sql
  python scripts/seed/generate.py --down > cleanup.sql

All seeded accounts share password `seed1234` (email domain seed.linqorbit.dev).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import re
import sys
import uuid
from datetime import date, datetime, timedelta

# --- fixed knobs -----------------------------------------------------------

NS = uuid.uuid5(uuid.NAMESPACE_DNS, "linqorbit.seed.v1")
RNG_SEED = 20261012
N_CANDIDATES = 100
N_RECRUITERS = 15
N_OFFERS = 100
DOMAIN = "seed.linqorbit.dev"
BCRYPT_HASH = "$2b$10$QOY0zycTVQxPftcJpw0cAu/WxzgF5vtMySjcEtBYhTlMWjHWFzeqW"  # seed1234
BASE = datetime(2026, 9, 1, 8, 0, 0)

SENIORITY = ["junior", "mid", "senior", "lead", "principal"]
SENIORITY_SMALLINT = {"junior": 1, "mid": 2, "senior": 3, "lead": 4, "principal": 5}
CONTRACT_SNAKE = {
    "Permanent": "permanent",
    "Fixed-term": "fixed_term",
    "Freelance": "freelance",
    "Internship": "internship",
    "Apprenticeship": "apprenticeship",
    "Volunteer": "volunteer",
}

# --- helpers ---------------------------------------------------------------


def uid(*parts: object) -> str:
    return str(uuid.uuid5(NS, "|".join(str(p) for p in parts)))


def q(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def j(value: object) -> str:
    """SQL literal for a JSONB column."""
    return "'" + json.dumps(value, ensure_ascii=False).replace("'", "''") + "'::jsonb"


def skill_ref(name: str) -> str:
    return f"(SELECT id FROM skills WHERE name = {q(name)})"


def lang_ref(symbol: str) -> str:
    return f"(SELECT id FROM languages WHERE symbol = {q(symbol)})"


def degree_ref(label: str) -> str:
    return f"(SELECT id FROM degrees WHERE label = {q(label)})"


def field_ref(label: str) -> str:
    return f"(SELECT id FROM study_fields WHERE label = {q(label)})"


def vocab_ref(table: str, label: str) -> str:
    return f"(SELECT id FROM {table} WHERE label = {q(label)})"


def ts(dt: datetime) -> str:
    return q(dt.strftime("%Y-%m-%d %H:%M:%S"))


def d(day: date) -> str:
    return q(day.isoformat())


def ym(day: date) -> str:
    return day.strftime("%Y-%m")


def add_months(day: date, months: int) -> date:
    m = day.month - 1 + months
    y = day.year + m // 12
    m = m % 12 + 1
    return date(y, m, min(day.day, 28))


def slugify(title: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return s[:120] or "offer"


def public_id(key: str) -> str:
    n = int(hashlib.sha256(key.encode()).hexdigest(), 16)
    alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = []
    for _ in range(12):
        n, r = divmod(n, 36)
        out.append(alphabet[r])
    return "".join(out)


# --- pools -------------------------------------------------------------------

FIRST_NAMES = [
    "Camille", "Thomas", "Léa", "Nicolas", "Chloé", "Julien", "Manon", "Antoine",
    "Sarah", "Hugo", "Emma", "Lucas", "Inès", "Rayan", "Laura", "Mehdi",
    "Alice", "Paul", "Jade", "Louis", "Nora", "Samir", "Élise", "Victor",
    "Maya", "Adam", "Zoé", "Gabriel", "Lina", "Yanis", "Anna", "Mattéo",
    "Sofia", "Omar", "Clara", "Félix", "Amina", "Théo", "Eva", "Noah",
]

LAST_NAMES = [
    "Martin", "Bernard", "Dubois", "Robert", "Richard", "Petit", "Durand",
    "Leroy", "Moreau", "Simon", "Laurent", "Lefebvre", "Michel", "Garcia",
    "David", "Bertrand", "Roux", "Vincent", "Fournier", "Morel", "Girard",
    "André", "Mercier", "Blanc", "Boyer", "Garnier", "Chevalier", "François",
    "Martinez", "Legrand", "Gauthier", "Perrin", "Robin", "Clement", "Morin",
    "Nguyen", "Benali", "Traoré", "Diallo", "Haddad", "Kowalski", "Ivanov",
]

CITIES = [
    ("Paris", "FR"), ("Lyon", "FR"), ("Toulouse", "FR"), ("Nantes", "FR"),
    ("Bordeaux", "FR"), ("Brussels", "BE"), ("Geneva", "CH"), ("Berlin", "DE"),
    ("Munich", "DE"), ("Amsterdam", "NL"), ("Madrid", "ES"), ("Barcelona", "ES"),
    ("Lisbon", "PT"), ("London", "GB"), ("Dublin", "IE"), ("Milan", "IT"),
    ("Luxembourg", "LU"), ("Vienna", "AT"), ("Stockholm", "SE"), ("Warsaw", "PL"),
    ("Prague", "CZ"), ("Bucharest", "RO"), ("Toronto", "CA"), ("Montreal", "CA"),
    ("Casablanca", "MA"), ("Tunis", "TN"), ("Dakar", "SN"), ("Abidjan", "CI"),
    ("Algiers", "DZ"), ("Rabat", "MA"),
]

LANG_NAMES = {
    "en": "English", "fr": "French", "es": "Spanish", "de": "German",
    "it": "Italian", "pt": "Portuguese", "nl": "Dutch", "pl": "Polish",
    "sv": "Swedish", "ar": "Arabic", "zh": "Chinese", "ja": "Japanese",
    "hi": "Hindi", "ru": "Russian", "tr": "Turkish", "ko": "Korean",
    "da": "Danish", "fi": "Finnish", "no": "Norwegian", "el": "Greek",
    "cs": "Czech", "ro": "Romanian", "hu": "Hungarian", "uk": "Ukrainian",
    "vi": "Vietnamese", "th": "Thai", "id": "Indonesian", "he": "Hebrew",
    "fa": "Persian", "sw": "Swahili", "ca": "Catalan", "sr": "Serbian",
}

INSTITUTIONS = [
    "Université de Technologie", "Institut Supérieur d'Informatique",
    "École Polytechnique", "Technical University", "University of Applied Sciences",
    "ENSEEIHT", "IUT Paris", "Centrale Alumni", "Online Tech Institute",
    "Business School of Europe",
]

COMPANY_NAMES = [
    "Nexora", "BluePeak Systems", "Dataforge", "Cloudhaven", "Lumen Labs",
    "Vertigo Software", "Stackline", "Orbita Digital", "Fintechis", "Greenstack",
    "Pixelforge", "Skyward IT", "Quantia", "Redwood Labs", "Helios Tech",
    "Astraflow", "Cobalt Works", "Driftware", "Everlyn", "Foundry Digital",
    "Granite Soft", "Hyperion Labs", "Ironclad IT", "Junction Tech", "Kinetic Labs",
    "Meridian Systems", "Northbeam", "Opaline Tech", "Pinnacle Works", "Quartz Digital",
    "Ridgeline", "Slate & Co Software", "Timberline Tech", "Umbra Systems",
    "Velvet Code", "Westgate Labs", "Xenon Partners", "Yellowbird Digital",
    "Zenith Works", "Clearpath Software",
]

BENEFITS = [
    "Remote-friendly policy", "Annual learning budget", "Health insurance",
    "Flexible hours", "Stock options", "Public transport pass",
    "Home office setup budget", "Regular team retreats",
]

# --- archetypes ---------------------------------------------------------------
# tech entries: (skill name in DB, SkillCategory for the normalized sheet)

ARCHETYPES = [
    {
        "key": "java-backend",
        "title": "Backend Engineer",
        "target": "Senior Backend Engineer",
        "domain": "enterprise applications",
        "tech": [
            ("Java", "programming_language"), ("Spring Boot", "framework"),
            ("Hibernate", "framework"), ("REST APIs", "technical_skill"),
            ("PostgreSQL", "tool"), ("Maven", "tool"), ("Docker", "tool"),
            ("AWS", "tool"), ("Git", "tool"), ("Microservices", "framework"),
            ("CI/CD", "methodology"),
        ],
        "soft": [("Communication", "soft_skill"), ("Teamwork", "soft_skill"), ("Problem solving", "soft_skill")],
        "exp_titles": ["Backend Developer", "Java Developer", "Software Engineer", "Senior Backend Engineer"],
        "responsibilities": [
            "Design and evolve RESTful microservices",
            "Own the PostgreSQL data model and query performance",
            "Operate services on Docker and Kubernetes",
            "Improve CI/CD pipelines and production observability",
        ],
        "degree": "Bachelor's degree",
        "field": "Software Engineering",
        "off_title": "Java Backend Engineer",
        "offer_domain": "backend engineering",
    },
    {
        "key": "frontend-react",
        "title": "Frontend Engineer",
        "target": "Senior Frontend Engineer",
        "domain": "web applications",
        "tech": [
            ("React", "framework"), ("TypeScript", "programming_language"),
            ("JavaScript", "programming_language"), ("Next.js", "framework"),
            ("Redux", "library"), ("Tailwind CSS", "framework"), ("CSS", "programming_language"),
            ("HTML", "programming_language"), ("GraphQL", "technical_skill"),
            ("REST APIs", "technical_skill"), ("Git", "tool"),
        ],
        "soft": [("Communication", "soft_skill"), ("Creativity", "soft_skill"), ("Attention to detail", "soft_skill")],
        "exp_titles": ["Frontend Developer", "React Developer", "Web Engineer", "Senior Frontend Engineer"],
        "responsibilities": [
            "Build accessible, performant user interfaces in React",
            "Own the TypeScript component library and design system",
            "Integrate GraphQL and REST backends",
            "Champion UI performance and Core Web Vitals",
        ],
        "degree": "Bachelor's degree",
        "field": "Computer Science",
        "off_title": "React Frontend Engineer",
        "offer_domain": "web engineering",
    },
    {
        "key": "fullstack",
        "title": "Full-Stack Developer",
        "target": "Full-Stack Engineer",
        "domain": "SaaS products",
        "tech": [
            ("TypeScript", "programming_language"), ("Node.js", "programming_language"),
            ("Express.js", "framework"), ("React", "framework"),
            ("PostgreSQL", "tool"), ("MongoDB", "tool"), ("Docker", "tool"),
            ("Git", "tool"), ("REST APIs", "technical_skill"), ("AWS", "tool"),
            ("Agile Methodology", "methodology"),
        ],
        "soft": [("Teamwork", "soft_skill"), ("Autonomy", "soft_skill"), ("Communication", "soft_skill")],
        "exp_titles": ["Full-Stack Developer", "Software Engineer", "Web Developer", "Senior Full-Stack Developer"],
        "responsibilities": [
            "Ship features across the Node.js API and React frontend",
            "Design PostgreSQL schemas and Mongo collections",
            "Keep the Docker-based delivery pipeline healthy",
            "Participate in Agile ceremonies and code reviews",
        ],
        "degree": "Bachelor's degree",
        "field": "Information Systems",
        "off_title": "Full-Stack Developer",
        "offer_domain": "product engineering",
    },
    {
        "key": "devops",
        "title": "DevOps Engineer",
        "target": "Senior DevOps Engineer",
        "domain": "cloud infrastructure",
        "tech": [
            ("Docker", "tool"), ("Kubernetes", "tool"), ("Terraform", "tool"),
            ("Ansible", "tool"), ("AWS", "tool"), ("CI/CD", "methodology"),
            ("Linux", "tool"), ("Bash", "programming_language"),
            ("Prometheus", "tool"), ("Grafana", "tool"), ("Jenkins", "tool"), ("Git", "tool"),
        ],
        "soft": [("Problem solving", "soft_skill"), ("Stress management", "soft_skill"), ("Autonomy", "soft_skill")],
        "exp_titles": ["DevOps Engineer", "Infrastructure Engineer", "SRE", "Senior DevOps Engineer"],
        "responsibilities": [
            "Operate Kubernetes clusters on AWS",
            "Maintain Terraform infrastructure as code",
            "Run CI/CD tooling and release automation",
            "Own monitoring with Prometheus and Grafana",
        ],
        "degree": "Bachelor's degree",
        "field": "Computer Science",
        "off_title": "DevOps Engineer",
        "offer_domain": "platform engineering",
    },
    {
        "key": "data-scientist",
        "title": "Data Scientist",
        "target": "Senior Data Scientist",
        "domain": "machine learning",
        "tech": [
            ("Python", "programming_language"), ("scikit-learn", "library"),
            ("TensorFlow", "library"), ("PyTorch", "library"), ("SQL", "technical_skill"),
            ("PostgreSQL", "tool"), ("Jupyter", "tool"), ("Matplotlib", "library"),
            ("Hugging Face", "tool"), ("Apache Spark", "tool"),
        ],
        "soft": [("Analytical skills", "soft_skill"), ("Critical thinking", "soft_skill"), ("Communication", "soft_skill")],
        "exp_titles": ["Data Scientist", "Machine Learning Engineer", "Research Analyst", "Senior Data Scientist"],
        "responsibilities": [
            "Train and evaluate machine learning models",
            "Prototype experiments in Jupyter notebooks",
            "Productionize models with scikit-learn and PyTorch",
            "Communicate findings to product stakeholders",
        ],
        "degree": "Master's degree",
        "field": "Mathematics",
        "off_title": "Data Scientist",
        "offer_domain": "data science",
    },
    {
        "key": "data-engineer",
        "title": "Data Engineer",
        "target": "Senior Data Engineer",
        "domain": "data platforms",
        "tech": [
            ("Python", "programming_language"), ("Apache Spark", "tool"),
            ("Apache Airflow", "tool"), ("SQL", "technical_skill"), ("PostgreSQL", "tool"),
            ("Apache Kafka", "tool"), ("Hadoop", "tool"), ("Docker", "tool"),
            ("AWS", "tool"), ("CI/CD", "methodology"),
        ],
        "soft": [("Problem solving", "soft_skill"), ("Attention to detail", "soft_skill"), ("Teamwork", "soft_skill")],
        "exp_titles": ["Data Engineer", "ETL Developer", "Analytics Engineer", "Senior Data Engineer"],
        "responsibilities": [
            "Build and maintain Spark data pipelines",
            "Orchestrate batch jobs with Airflow",
            "Stream events through Kafka",
            "Own the warehouse SQL layer",
        ],
        "degree": "Master's degree",
        "field": "Information Systems",
        "off_title": "Data Engineer",
        "offer_domain": "data engineering",
    },
    {
        "key": "mobile",
        "title": "Mobile Developer",
        "target": "Senior Mobile Developer",
        "domain": "mobile applications",
        "tech": [
            ("Swift", "programming_language"), ("Kotlin", "programming_language"),
            ("Flutter", "framework"), ("React Native", "framework"),
            ("Dart", "programming_language"), ("Git", "tool"),
            ("REST APIs", "technical_skill"),
        ],
        "soft": [("Creativity", "soft_skill"), ("Attention to detail", "soft_skill"), ("Autonomy", "soft_skill")],
        "exp_titles": ["Mobile Developer", "iOS Developer", "Android Developer", "Senior Mobile Engineer"],
        "responsibilities": [
            "Build native iOS and Android features",
            "Ship cross-platform apps with Flutter",
            "Integrate mobile clients with REST APIs",
            "Maintain app store releases and crash-free rates",
        ],
        "degree": "Bachelor's degree",
        "field": "Computer Science",
        "off_title": "Mobile Developer",
        "offer_domain": "mobile engineering",
    },
    {
        "key": "ux-designer",
        "title": "UX Designer",
        "target": "Senior UX Designer",
        "domain": "product design",
        "tech": [
            ("Figma", "tool"), ("UX Design", "technical_skill"), ("UI Design", "technical_skill"),
            ("Wireframing", "methodology"), ("Prototyping", "methodology"),
            ("UX Research", "methodology"), ("Design Systems", "methodology"),
            ("Interaction Design", "technical_skill"), ("Typography", "technical_skill"),
            ("Adobe Photoshop", "tool"),
        ],
        "soft": [("Creativity", "soft_skill"), ("Communication", "soft_skill"), ("Attention to detail", "soft_skill")],
        "exp_titles": ["UX Designer", "Product Designer", "UI Designer", "Senior UX Designer"],
        "responsibilities": [
            "Run discovery workshops and user interviews",
            "Design flows and high-fidelity screens in Figma",
            "Own and evolve the design system",
            "Prototype interactions and validate with usability tests",
        ],
        "degree": "Bachelor's degree",
        "field": "Arts & Design",
        "off_title": "UX Designer",
        "offer_domain": "design",
    },
    {
        "key": "product-manager",
        "title": "Product Manager",
        "target": "Senior Product Manager",
        "domain": "digital products",
        "tech": [
            ("Product Management", "methodology"), ("Stakeholder Management", "methodology"),
            ("Business Analysis", "methodology"), ("Agile Methodology", "methodology"),
            ("Scrum", "methodology"), ("Jira", "tool"), ("Market Research", "methodology"),
        ],
        "soft": [("Leadership", "soft_skill"), ("Communication", "soft_skill"), ("Strategic Planning", "soft_skill"), ("Negotiation", "soft_skill")],
        "exp_titles": ["Product Manager", "Product Owner", "Business Analyst", "Senior Product Manager"],
        "responsibilities": [
            "Own the product roadmap and prioritization",
            "Translate business goals into user stories",
            "Lead Agile ceremonies with engineering",
            "Run market research and competitive analysis",
        ],
        "degree": "Master's degree",
        "field": "Business Administration",
        "off_title": "Product Manager",
        "offer_domain": "product management",
    },
    {
        "key": "qa-engineer",
        "title": "QA Engineer",
        "target": "Senior QA Engineer",
        "domain": "quality engineering",
        "tech": [
            ("Selenium", "tool"), ("CI/CD", "methodology"), ("Postman", "tool"),
            ("SQL", "technical_skill"), ("Jira", "tool"), ("Git", "tool"),
            ("Linux", "tool"), ("Agile Methodology", "methodology"), ("REST APIs", "technical_skill"),
        ],
        "soft": [("Attention to detail", "soft_skill"), ("Problem solving", "soft_skill"), ("Teamwork", "soft_skill")],
        "exp_titles": ["QA Engineer", "Test Engineer", "QA Analyst", "Senior QA Engineer"],
        "responsibilities": [
            "Design and maintain Selenium test suites",
            "Automate API checks with Postman",
            "Own release quality gates in CI/CD",
            "Report and track defects in Jira",
        ],
        "degree": "Bachelor's degree",
        "field": "Software Engineering",
        "off_title": "QA Automation Engineer",
        "offer_domain": "quality engineering",
    },
    {
        "key": "marketing",
        "title": "Digital Marketing Manager",
        "target": "Senior Marketing Manager",
        "domain": "growth marketing",
        "tech": [
            ("SEO", "methodology"), ("SEM", "methodology"), ("Google Analytics", "tool"),
            ("Content Marketing", "methodology"), ("Email Marketing", "methodology"),
            ("Social Media Marketing", "methodology"), ("Campaign Management", "methodology"),
            ("Market Research", "methodology"), ("Brand Strategy", "methodology"),
        ],
        "soft": [("Creativity", "soft_skill"), ("Communication", "soft_skill"), ("Analytical skills", "soft_skill")],
        "exp_titles": ["Marketing Manager", "Growth Manager", "Digital Marketing Specialist", "Senior Marketing Manager"],
        "responsibilities": [
            "Plan and run multi-channel acquisition campaigns",
            "Own SEO/SEM performance and budgets",
            "Report growth metrics in Google Analytics",
            "Coordinate content and email programs",
        ],
        "degree": "Bachelor's degree",
        "field": "Marketing",
        "off_title": "Digital Marketing Manager",
        "offer_domain": "marketing",
    },
    {
        "key": "sales",
        "title": "Account Executive",
        "target": "Senior Account Executive",
        "domain": "B2B sales",
        "tech": [
            ("B2B Sales", "business_domain"), ("CRM", "tool"), ("Lead Generation", "methodology"),
            ("Negotiation", "methodology"), ("Account Management", "methodology"),
            ("Upselling", "methodology"), ("Cold Calling", "methodology"), ("HubSpot", "tool"),
        ],
        "soft": [("Communication", "soft_skill"), ("Relationship Building", "soft_skill"), ("Resilience", "soft_skill")],
        "exp_titles": ["Account Executive", "Sales Executive", "Business Development Manager", "Senior Account Executive"],
        "responsibilities": [
            "Own the full B2B sales cycle in HubSpot",
            "Generate and qualify inbound and outbound leads",
            "Negotiate contracts and close deals",
            "Grow existing accounts through upselling",
        ],
        "degree": "Bachelor's degree",
        "field": "Management",
        "off_title": "B2B Account Executive",
        "offer_domain": "sales",
    },
    {
        "key": "php-backend",
        "title": "PHP Developer",
        "target": "Senior PHP Developer",
        "domain": "web backends",
        "tech": [
            ("PHP", "programming_language"), ("Laravel", "framework"), ("MySQL", "tool"),
            ("Symfony", "framework"), ("Docker", "tool"), ("Git", "tool"),
            ("REST APIs", "technical_skill"), ("Linux", "tool"),
        ],
        "soft": [("Teamwork", "soft_skill"), ("Problem solving", "soft_skill"), ("Communication", "soft_skill")],
        "exp_titles": ["PHP Developer", "Laravel Developer", "Web Developer", "Senior PHP Developer"],
        "responsibilities": [
            "Build and maintain Laravel and Symfony applications",
            "Design MySQL schemas and optimize queries",
            "Deploy services with Docker on Linux",
            "Expose and consume REST APIs",
        ],
        "degree": "Bachelor's degree",
        "field": "Computer Science",
        "off_title": "PHP / Laravel Developer",
        "offer_domain": "web engineering",
    },
    {
        "key": "go-backend",
        "title": "Go Backend Engineer",
        "target": "Senior Go Engineer",
        "domain": "distributed systems",
        "tech": [
            ("Go", "programming_language"), ("PostgreSQL", "tool"), ("Docker", "tool"),
            ("Kubernetes", "tool"), ("REST APIs", "technical_skill"), ("Git", "tool"),
            ("Linux", "tool"), ("Microservices", "framework"),
        ],
        "soft": [("Autonomy", "soft_skill"), ("Problem solving", "soft_skill"), ("Teamwork", "soft_skill")],
        "exp_titles": ["Go Developer", "Backend Engineer", "Systems Engineer", "Senior Go Engineer"],
        "responsibilities": [
            "Build high-throughput microservices in Go",
            "Design PostgreSQL schemas for scale",
            "Operate services on Kubernetes",
            "Profile and tune latency-critical paths",
        ],
        "degree": "Bachelor's degree",
        "field": "Software Engineering",
        "off_title": "Go Backend Engineer",
        "offer_domain": "backend engineering",
    },
    {
        "key": "dotnet",
        "title": ".NET Developer",
        "target": "Senior .NET Developer",
        "domain": "enterprise software",
        "tech": [
            ("C#", "programming_language"), (".NET", "framework"), ("ASP.NET Core", "framework"),
            ("Microsoft SQL Server", "tool"), ("Azure", "tool"), ("Docker", "tool"),
            ("Git", "tool"), ("REST APIs", "technical_skill"),
        ],
        "soft": [("Communication", "soft_skill"), ("Attention to detail", "soft_skill"), ("Teamwork", "soft_skill")],
        "exp_titles": [".NET Developer", "C# Developer", "Software Engineer", "Senior .NET Developer"],
        "responsibilities": [
            "Build ASP.NET Core web APIs",
            "Own Microsoft SQL Server schemas and queries",
            "Deploy workloads to Azure",
            "Containerize services with Docker",
        ],
        "degree": "Bachelor's degree",
        "field": "Software Engineering",
        "off_title": ".NET Developer",
        "offer_domain": "enterprise software",
    },
]

PROJECT_NAMES = [
    "Internal tooling platform", "Customer portal revamp", "Realtime analytics dashboard",
    "Payment gateway integration", "Inventory optimization engine", "Mobile companion app",
    "Design system rollout", "Data migration program", "Search experience rewrite",
    "Observability overhaul",
]

BIO_TEMPLATES = [
    "{years} years of {domain} experience. Comfortable end to end: from design discussions to production incidents. I enjoy mentoring and clean, tested code.",
    "{years} years working on {domain}. I care about shipping measurable value, simple architectures and kind team processes.",
    "Backend-leaning {domain} professional with {years} years of experience. I like ownership, clear metrics and pragmatic trade-offs.",
    "{domain} practitioner, {years} years in production teams. Curious, autonomous, and happy to wear several hats.",
]

EXP_DESC_TEMPLATES = [
    "Worked on {domain} features with {tech}. Participated in design reviews and on-call rotations.",
    "Delivered {domain} improvements using {tech}. Collaborated with product and design daily.",
    "Maintained production {domain} services built with {tech}. Focused on reliability and delivery speed.",
]

OFFER_DESC_TEMPLATES = [
    "We are hiring a {title} to join our {domain} team. You will own high-impact projects from idea to production.",
    "Our {domain} team is looking for a {title}. Expect real ownership, close collaboration and a fast feedback loop.",
    "Join us as {title} and help shape our {domain}. We value craftsmanship, transparency and steady delivery.",
]

LANG_CHOICES = ["es", "de", "it", "pt", "nl", "pl", "sv", "ar", "zh", "ja", "ru", "tr", "ko", "da", "fi"]

CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"]

SENIORITY_SPANS = {"junior": (0, 2), "mid": (3, 5), "senior": (6, 9), "lead": (10, 14), "principal": (12, 18)}
SENIORITY_BASE_LEVEL = {"junior": 3, "mid": 4, "senior": 4, "lead": 5, "principal": 5}
SENIORITY_MIN_YEARS = {"junior": 0, "mid": 3, "senior": 6, "lead": 10, "principal": 12}
SALARY_BANDS = {
    "junior": (38000, 52000),
    "mid": (48000, 68000),
    "senior": (62000, 88000),
    "lead": (80000, 105000),
    "principal": (95000, 125000),
}


# --- candidate generation -------------------------------------------------------


def build_experiences(rng: random.Random, arch: dict, years: int) -> list[dict]:
    n = max(1, min(4, 1 + years // 3))
    today = date(2026, 10, 1)
    exps = []
    end_cursor = None if rng.random() < 0.65 else today - timedelta(days=rng.randint(15, 120))
    for k in range(n):
        duration_m = rng.randint(10, max(14, min(48, (years * 12) // max(n, 1) + 8)))
        start = add_months(end_cursor if end_cursor else today, -duration_m)
        exps.append(
            {
                "position_title": rng.choice(arch["exp_titles"]),
                "company_name": rng.choice(COMPANY_NAMES),
                "company_country": rng.choice(CITIES)[1],
                "start": start,
                "end": end_cursor,
                "description": EXP_DESC_TEMPLATES[k % len(EXP_DESC_TEMPLATES)].format(
                    domain=arch["domain"],
                    tech=", ".join(t for t, _ in arch["tech"][:3]),
                ),
            }
        )
        end_cursor = add_months(start, -1)
    return exps


def build_diplomas(rng: random.Random, arch: dict, years: int) -> list[dict]:
    grad_year = 2026 - max(years, 1) + rng.randint(0, 2)
    dip = {
        "title": arch["degree"],
        "institution": rng.choice(INSTITUTIONS),
        "institution_country": rng.choice(CITIES)[1],
        "start": date(grad_year - 3, 9, 15),
        "end": date(grad_year, 6, 30),
        "degree_label": arch["degree"],
        "study_field_label": arch["field"],
    }
    out = [dip]
    if rng.random() < 0.35:
        cert_start = date(2026 - rng.randint(1, 4), rng.randint(1, 10), 1)
        out.insert(
            0,
            {
                "title": "Professional certificate",
                "institution": "Online Tech Institute",
                "institution_country": "FR",
                "start": cert_start,
                "end": add_months(cert_start, rng.randint(3, 12)),
                "degree_label": "Professional certificate",
                "study_field_label": arch["field"],
            },
        )
    return out


def build_projects(rng: random.Random, arch: dict) -> list[dict]:
    tech_names = [t for t, _ in arch["tech"]]
    out = []
    for _ in range(rng.randint(1, 2)):
        start_m = rng.randint(12, 40)
        out.append(
            {
                "name": rng.choice(PROJECT_NAMES),
                "role": arch["exp_titles"][0],
                "description": f"Personal project in {arch['domain']} using {', '.join(tech_names[:3])}.",
                "start": add_months(date(2026, 9, 1), -start_m),
                "end": add_months(date(2026, 9, 1), -start_m + rng.randint(4, 14)),
                "technologies": ", ".join(tech_names[: rng.randint(3, 5)]),
            }
        )
    return out


def build_languages(rng: random.Random) -> list[tuple[str, str]]:
    langs: list[tuple[str, str]] = [("en", rng.choice(["B2", "C1", "C2"])), ("fr", rng.choice(["B2", "C1", "C2"]))]
    for _ in range(rng.randint(0, 2)):
        sym = rng.choice(LANG_CHOICES)
        if sym not in {s for s, _ in langs}:
            langs.append((sym, rng.choice(CEFR[1:])))
    return langs


def generate_candidate(i: int, rng: random.Random) -> dict:
    arch = ARCHETYPES[i % len(ARCHETYPES)]
    seniority = rng.choices(SENIORITY, weights=[15, 35, 35, 12, 3], k=1)[0]
    lo, hi = SENIORITY_SPANS[seniority]
    years = rng.randint(lo, hi)
    first = rng.choice(FIRST_NAMES)
    last = rng.choice(LAST_NAMES)
    city, country = rng.choice(CITIES)
    experiences = build_experiences(rng, arch, years)
    diplomas = build_diplomas(rng, arch, years)
    projects = build_projects(rng, arch)
    languages = build_languages(rng)
    skills = list(arch["tech"]) + list(arch["soft"])
    rng.shuffle(skills)

    created = BASE + timedelta(days=i % 28, hours=rng.randint(0, 8), minutes=rng.randint(0, 59))
    profile_updated = created + timedelta(hours=rng.randint(2, 36))
    validated = profile_updated + timedelta(days=1, hours=rng.randint(1, 6))

    slug = f"{first}.{last}.{i}".lower().replace(" ", "")
    search_status = rng.choices([1, 2, 3], weights=[60, 30, 10], k=1)[0]
    search_status_str = {1: "open_to_work", 2: "selective", 3: "not_looking"}[search_status]
    bio = rng.choice(BIO_TEMPLATES).format(years=years, domain=arch["domain"])

    return {
        "i": i,
        "arch": arch,
        "first": first,
        "last": last,
        "email": f"{slug}@{DOMAIN}",
        "city": city,
        "country": country,
        "sex": rng.choice([1, 2, 3]),
        "seniority": seniority,
        "years": years,
        "title": f"{seniority.capitalize()} {arch['title']}",
        "bio": bio,
        "target": arch["target"],
        "search_status": search_status,
        "search_status_str": search_status_str,
        "created": created,
        "profile_updated": profile_updated,
        "validated": validated,
        "experiences": experiences,
        "projects": projects,
        "diplomas": diplomas,
        "languages": languages,
        "skills": skills,
        "user_id": uid("user", "cand", i),
        "np_id": uid("np", "cand", i),
    }


# --- SQL emission: candidates ----------------------------------------------------


def emit_candidate(c: dict, rng: random.Random) -> list[str]:
    i = c["i"]
    uid_ = c["user_id"]
    lines: list[str] = []

    lines.append(
        f"INSERT INTO users (id, email, password_hash, first_name, last_name, phone, status, created_at, updated_at, sex, home_country, current_city, current_country) VALUES "
        f"({q(uid_)}, {q(c['email'])}, {q(BCRYPT_HASH)}, {q(c['first'])}, {q(c['last'])}, NULL, 1, {ts(c['created'])}, {ts(c['profile_updated'])}, {c['sex']}, {q(c['country'])}, {q(c['city'])}, {q(c['country'])});"
    )
    lines.append(
        f"INSERT INTO candidates (id, created_at, updated_at, title, bio, years_of_experience, search_status, target_position) VALUES "
        f"({q(uid_)}, {ts(c['created'])}, {ts(c['profile_updated'])}, {q(c['title'])}, {q(c['bio'])}, {c['years']}, {c['search_status']}, {q(c['target'])});"
    )

    for k, exp in enumerate(c["experiences"]):
        end_sql = d(exp["end"]) if exp["end"] else "NULL"
        lines.append(
            f"INSERT INTO professional_experiences (id, candidate_id, job_position_id, position_title, description, start_date, end_date, company_name, company_country, sort_order, created_at, updated_at) VALUES "
            f"({q(uid('exp', i, k))}, {q(uid_)}, NULL, {q(exp['position_title'])}, {q(exp['description'])}, {d(exp['start'])}, {end_sql}, "
            f"{q(exp['company_name'])}, {q(exp['company_country'])}, {k}, {ts(c['created'])}, {ts(c['profile_updated'])});"
        )

    for k, prj in enumerate(c["projects"]):
        lines.append(
            f"INSERT INTO candidate_projects (id, candidate_id, name, role, description, start_date, end_date, technologies, sort_order, created_at, updated_at) VALUES "
            f"({q(uid('proj', i, k))}, {q(uid_)}, {q(prj['name'])}, {q(prj['role'])}, {q(prj['description'])}, {d(prj['start'])}, {d(prj['end'])}, "
            f"{q(prj['technologies'])}, {k}, {ts(c['created'])}, {ts(c['profile_updated'])});"
        )

    for k, dip in enumerate(c["diplomas"]):
        lines.append(
            f"INSERT INTO diplomas (id, candidate_id, title, start_date, end_date, institution, institution_country, degree_id, study_field_id, sort_order, created_at, updated_at) VALUES "
            f"({q(uid('dip', i, k))}, {q(uid_)}, {q(dip['title'])}, {d(dip['start'])}, {d(dip['end'])}, {q(dip['institution'])}, {q(dip['institution_country'])}, "
            f"{degree_ref(dip['degree_label'])}, {field_ref(dip['study_field_label'])}, {k}, {ts(c['created'])}, {ts(c['profile_updated'])});"
        )

    base_level = SENIORITY_BASE_LEVEL[c["seniority"]]
    for k, (name, _cat) in enumerate(c["skills"]):
        lvl = min(5, max(2, base_level + rng.randint(-1, 0)))
        lines.append(
            f"INSERT INTO candidate_skills (id, candidate_id, skill_id, level, years_experience) VALUES "
            f"({q(uid('cskill', i, k))}, {q(uid_)}, {skill_ref(name)}, {lvl}, {min(c['years'], max(1, c['years'] - k % 3))});"
        )

    for k, (sym, lvl) in enumerate(c["languages"]):
        lines.append(
            f"INSERT INTO candidate_languages (id, candidate_id, language_id, level) VALUES "
            f"({q(uid('clang', i, k))}, {q(uid_)}, {lang_ref(sym)}, {q(lvl)});"
        )

    links = [
        ("LinkedIn", f"https://www.linkedin.com/in/{c['first'].lower()}-{c['last'].lower()}-{i}", 1),
        ("GitHub", f"https://github.com/{c['first'].lower()}{c['last'].lower()}{i}", 2),
    ]
    for k, (label, url, ltype) in enumerate(links):
        lines.append(
            f"INSERT INTO candidate_links (id, candidate_id, label, url, link_type, issuer, issued_at, sort_order, created_at, updated_at) VALUES "
            f"({q(uid('link', i, k))}, {q(uid_)}, {q(label)}, {q(url)}, {ltype}, NULL, NULL, {k}, {ts(c['created'])}, {ts(c['profile_updated'])});"
        )

    np_content = build_candidate_np(c)
    lines.append(
        f"INSERT INTO normalized_profile (normalized_profile_id, version, schema_version, content, validated_at, created_at, updated_at) VALUES "
        f"({q(c['np_id'])}, 1, '2', {j(np_content)}, {ts(c['validated'])}, {ts(c['validated'])}, {ts(c['validated'])});"
    )
    lines.append(
        f"INSERT INTO normalized_profile_candidate (normalized_profile_id, candidate_id) VALUES ({q(c['np_id'])}, {q(uid_)});"
    )
    lines.append(
        f"INSERT INTO normalization_job (job_id, status, source_type, attempts, next_attempt_at, error, created_at, started_at, completed_at) VALUES "
        f"({q(c['np_id'])}, 3, 1, 0, {ts(c['validated'])}, NULL, {ts(c['validated'] - timedelta(minutes=4))}, "
        f"{ts(c['validated'] - timedelta(minutes=4))}, {ts(c['validated'])});"
    )
    return lines


def build_candidate_np(c: dict) -> dict:
    arch = c["arch"]
    experiences = [
        {
            "positionTitle": exp["position_title"],
            "companyName": exp["company_name"],
            "companyCountry": exp["company_country"],
            "startDate": ym(exp["start"]),
            "endDate": ym(exp["end"]) if exp["end"] else None,
            "description": exp["description"],
            "domain": arch["domain"],
            "responsibilities": arch["responsibilities"][:2],
            "technologies": [t for t, _ in arch["tech"][:4]],
            "achievements": [],
        }
        for exp in c["experiences"]
    ]
    projects = [
        {
            "name": prj["name"],
            "role": prj["role"],
            "description": prj["description"],
            "startDate": ym(prj["start"]),
            "endDate": ym(prj["end"]) if prj["end"] else None,
            "context": "professional",
            "domain": arch["domain"],
            "responsibilities": [],
            "technologies": [t.strip() for t in prj["technologies"].split(",")],
            "achievements": [],
        }
        for prj in c["projects"]
    ]
    diplomas = [
        {
            "title": dip["title"],
            "institution": dip["institution"],
            "institutionCountry": dip["institution_country"],
            "degreeLabel": dip["degree_label"],
            "studyFieldLabel": dip["study_field_label"],
            "startDate": ym(dip["start"]),
            "endDate": ym(dip["end"]),
        }
        for dip in c["diplomas"]
    ]
    languages = [{"name": LANG_NAMES.get(sym, sym), "level": lvl} for sym, lvl in c["languages"]]
    base_level = SENIORITY_BASE_LEVEL[c["seniority"]]
    skills = []
    for k, (name, cat) in enumerate(c["skills"]):
        skills.append(
            {
                "name": name,
                "category": cat,
                "level": min(5, max(2, base_level)),
                "levelSource": "declared",
                "yearsExperience": max(0, c["years"] - (k % 3)),
                "origin": "declared",
                "evidence": [{"source": "experience", "index": k % len(experiences)}] if experiences else [],
            }
        )
    skills.append(
        {
            "name": "Code review",
            "category": "methodology",
            "level": None,
            "levelSource": "inferred",
            "yearsExperience": None,
            "origin": "inferred",
            "evidence": [{"source": "experience", "index": 0}] if experiences else [],
        }
    )
    return {
        "schemaVersion": "2",
        "title": c["title"],
        "summary": (
            f"{c['seniority'].capitalize()} {arch['title'].lower()} with {c['years']} years "
            f"of {arch['domain']} experience."
        ),
        "yearsOfExperience": c["years"],
        "seniority": c["seniority"],
        "targetRole": c["target"],
        "searchStatus": c["search_status_str"],
        "location": {"city": c["city"], "country": c["country"]},
        "experiences": experiences,
        "projects": projects,
        "diplomas": diplomas,
        "languages": languages,
        "certifications": [],
        "links": [
            {
                "label": "LinkedIn",
                "url": f"https://www.linkedin.com/in/{c['first'].lower()}-{c['last'].lower()}-{c['i']}",
            }
        ],
        "skills": skills,
    }


# --- recruiters + offers ----------------------------------------------------------


def generate_recruiters(rng: random.Random) -> list[dict]:
    out = []
    for r in range(N_RECRUITERS):
        first = rng.choice(FIRST_NAMES)
        last = rng.choice(LAST_NAMES)
        created = BASE - timedelta(days=rng.randint(10, 40))
        out.append(
            {
                "r": r,
                "user_id": uid("user", "rec", r),
                "company_id": uid("company", r),
                "email": f"recruiter{r}@{DOMAIN}",
                "first": first,
                "last": last,
                "headline": rng.choice(
                    ["Talent Acquisition", "Head of Talent", "Recruiting Lead", "Technical Recruiter"]
                ),
                "bio": f"{first} {last} hires at scale with a human process.",
                "company": rng.choice(COMPANY_NAMES) + rng.choice(["", " SAS", " GmbH", " Ltd", " Inc", " BV"]),
                "company_desc": "We build products people love, with kind teams and high standards.",
                "created": created,
            }
        )
    return out


def emit_recruiter(rc: dict) -> list[str]:
    return [
        (
            f"INSERT INTO users (id, email, password_hash, first_name, last_name, phone, status, created_at, updated_at, sex, home_country, current_city, current_country) VALUES "
            f"({q(rc['user_id'])}, {q(rc['email'])}, {q(BCRYPT_HASH)}, {q(rc['first'])}, {q(rc['last'])}, NULL, 1, "
            f"{ts(rc['created'])}, {ts(rc['created'])}, NULL, 'FR', 'Paris', 'FR');"
        ),
        (
            f"INSERT INTO recruiters (id, created_at, updated_at, headline, bio) VALUES "
            f"({q(rc['user_id'])}, {ts(rc['created'])}, {ts(rc['created'])}, {q(rc['headline'])}, {q(rc['bio'])});"
        ),
        (
            f"INSERT INTO companies (id, name, description, created_at, updated_at) VALUES "
            f"({q(rc['company_id'])}, {q(rc['company'])}, {q(rc['company_desc'])}, {ts(rc['created'])}, {ts(rc['created'])});"
        ),
        (
            f"INSERT INTO company_members (company_id, recruiter_id, is_owner) VALUES "
            f"({q(rc['company_id'])}, {q(rc['user_id'])}, TRUE);"
        ),
    ]


def generate_offer(o: int, recruiters: list[dict], rng: random.Random) -> dict:
    arch = ARCHETYPES[o % len(ARCHETYPES)]
    rc = recruiters[o % len(recruiters)]
    seniority = rng.choices(SENIORITY, weights=[18, 34, 34, 12, 2], k=1)[0]
    prefix = {"junior": "Junior", "mid": "", "senior": "Senior", "lead": "Lead", "principal": "Principal"}[seniority]
    title = " ".join(filter(None, [prefix, arch["off_title"]])).strip()
    city, country = rng.choice(CITIES)

    if o < 70:
        status, status_name = 3, "PUBLISHED"
    elif o < 85:
        status, status_name = 2, "VALIDATED"
    elif o < 95:
        status, status_name = 1, "DRAFT"
    else:
        status, status_name = 4, "CLOSED"

    created = BASE + timedelta(days=(o % 40), hours=rng.randint(0, 7))
    validated = created + timedelta(days=rng.randint(1, 3)) if status >= 2 else None
    published = validated + timedelta(days=rng.randint(0, 2)) if status >= 3 else None
    expires = None if rng.random() < 0.85 else date(2026, 12, 31)

    contract = rng.choices(["Permanent", "Fixed-term", "Freelance", "Internship"], weights=[70, 15, 10, 5], k=1)[0]
    employment = rng.choices(["Full-time", "Part-time"], weights=[85, 15], k=1)[0]
    work_mode = rng.choice(["Remote", "Hybrid", "On-site"])

    aligned = (o % 10) < 6
    tech_pool = list(arch["tech"])
    if not aligned:
        other = ARCHETYPES[(o + 5) % len(ARCHETYPES)]
        tech_pool = tech_pool[: max(2, len(tech_pool) // 2)] + other["tech"][:3]
    seen_names: set[str] = set()
    deduped: list[tuple[str, str]] = []
    for entry in tech_pool:
        if entry[0] not in seen_names:
            seen_names.add(entry[0])
            deduped.append(entry)
    tech_pool = deduped

    required = tech_pool[: rng.randint(3, min(5, len(tech_pool)))]
    remaining = [t for t in tech_pool if t not in required]
    preferred = remaining[: rng.randint(0, min(4, len(remaining)))]

    sal_min, sal_max = SALARY_BANDS[seniority]

    desc_sentences = [tmpl.format(title=title, domain=arch["offer_domain"]) for tmpl in OFFER_DESC_TEMPLATES[:2]]
    desc_sentences.append("Core duties: " + "; ".join(arch["responsibilities"][:3]) + ".")

    return {
        "o": o,
        "arch": arch,
        "recruiter": rc,
        "title": title,
        "seniority": seniority,
        "city": city,
        "country": country,
        "status": status,
        "status_name": status_name,
        "created": created,
        "validated": validated,
        "published": published,
        "expires": expires,
        "contract": contract,
        "employment": employment,
        "work_mode": work_mode,
        "required": required,
        "preferred": preferred,
        "salary_min": sal_min,
        "salary_max": sal_max,
        "description_html": "".join(f"<p>{s}</p>" for s in desc_sentences),
        "description_plain": " ".join(desc_sentences),
        "offer_id": uid("offer", o),
        "np_id": uid("np", "offer", o),
        "public_id": public_id(f"offer|{o}"),
        "slug": slugify(title) + f"-{o}",
        "aligned": aligned,
        "languages": [("en", rng.choice(["B2", "C1"]), True)]
        + ([("fr", "B2", False)] if rng.random() < 0.4 else []),
        "degree_label": arch["degree"] if rng.random() < 0.5 else None,
        "field_label": arch["field"] if rng.random() < 0.5 else None,
    }


def emit_offer(off: dict) -> list[str]:
    rc = off["recruiter"]
    updated = off["validated"] or off["created"]
    lines: list[str] = []
    validated_sql = ts(off["validated"]) if off["validated"] else "NULL"
    published_sql = ts(off["published"]) if off["published"] else "NULL"
    expires_sql = d(off["expires"]) if off["expires"] else "NULL"
    lines.append(
        f"INSERT INTO job_offer (id, company_id, recruiter_id, status, title, description, seniority, required_exp_year, city, country, "
        f"contract_type_id, employment_type_id, work_mode_id, validated_at, published_at, expires_at, salary_min, salary_max, "
        f"salary_currency, salary_period, public_id, slug, created_at, updated_at) VALUES "
        f"({q(off['offer_id'])}, {q(rc['company_id'])}, {q(rc['user_id'])}, {off['status']}, {q(off['title'])}, {q(off['description_html'])}, "
        f"{SENIORITY_SMALLINT[off['seniority']]}, {SENIORITY_MIN_YEARS[off['seniority']]}, {q(off['city'])}, {q(off['country'])}, "
        f"{vocab_ref('contract_type', off['contract'])}, {vocab_ref('employment_type', off['employment'])}, {vocab_ref('work_mode', off['work_mode'])}, "
        f"{validated_sql}, {published_sql}, {expires_sql}, {off['salary_min']}, {off['salary_max']}, 'EUR', 1, "
        f"{q(off['public_id'])}, {q(off['slug'])}, {ts(off['created'])}, {ts(updated)});"
    )

    for k, (name, _cat) in enumerate(off["required"]):
        lines.append(
            f"INSERT INTO job_offer_skill (job_offer_id, skill_id, requirement_type, weight, years_experience) VALUES "
            f"({q(off['offer_id'])}, {skill_ref(name)}, 1, {5 - k % 3}, "
            f"{min(8, SENIORITY_MIN_YEARS[off['seniority']] + k % 2)});"
        )
    for k, (name, _cat) in enumerate(off["preferred"]):
        lines.append(
            f"INSERT INTO job_offer_skill (job_offer_id, skill_id, requirement_type, weight, years_experience) VALUES "
            f"({q(off['offer_id'])}, {skill_ref(name)}, 2, {max(1, 3 - k % 2)}, NULL);"
        )
    for sym, lvl, req in off["languages"]:
        lines.append(
            f"INSERT INTO job_offer_language (job_offer_id, language_id, level, is_required) VALUES "
            f"({q(off['offer_id'])}, {lang_ref(sym)}, {q(lvl)}, {'TRUE' if req else 'FALSE'});"
        )
    if off["degree_label"]:
        lines.append(
            f"INSERT INTO job_offer_degree (job_offer_id, degree_id) VALUES "
            f"({q(off['offer_id'])}, {degree_ref(off['degree_label'])});"
        )
    if off["field_label"]:
        lines.append(
            f"INSERT INTO job_offer_study_field (job_offer_id, study_field_id) VALUES "
            f"({q(off['offer_id'])}, {field_ref(off['field_label'])});"
        )

    np_content = build_offer_np(off)
    lines.append(
        f"INSERT INTO normalized_profile (normalized_profile_id, version, schema_version, content, validated_at, created_at, updated_at) VALUES "
        f"({q(off['np_id'])}, 1, '1', {j(np_content)}, {ts(updated)}, {ts(updated)}, {ts(updated)});"
    )
    lines.append(
        f"INSERT INTO normalized_profile_job_offer (normalized_profile_id, job_offer_id) VALUES "
        f"({q(off['np_id'])}, {q(off['offer_id'])});"
    )
    lines.append(
        f"INSERT INTO normalization_job (job_id, status, source_type, attempts, next_attempt_at, error, created_at, started_at, completed_at) VALUES "
        f"({q(off['np_id'])}, 3, 2, 0, {ts(updated)}, NULL, {ts(updated - timedelta(minutes=3))}, "
        f"{ts(updated - timedelta(minutes=3))}, {ts(updated)});"
    )
    return lines


def build_offer_np(off: dict) -> dict:
    arch = off["arch"]
    rc = off["recruiter"]
    responsibilities = [
        {
            "text": r,
            "importance": "mandatory",
            "domain": arch["offer_domain"],
            "technologies": [t for t, _ in arch["tech"][:3]],
        }
        for r in arch["responsibilities"][:4]
    ]
    responsibilities.append(
        {
            "text": "Mentor teammates and share knowledge across the squad",
            "importance": "optional",
            "domain": arch["offer_domain"],
            "technologies": [],
        }
    )
    req_skills = [
        {
            "name": name,
            "category": cat,
            "level": min(5, 3 + k % 3),
            "levelSource": "declared",
            "minYears": k % 5,
            "origin": "declared",
            "evidence": [{"source": "responsibility", "index": k % len(responsibilities)}],
        }
        for k, (name, cat) in enumerate(off["required"])
    ]
    pref_skills = [
        {
            "name": name,
            "category": cat,
            "level": None,
            "levelSource": None,
            "minYears": None,
            "origin": "declared",
            "evidence": [{"source": "responsibility", "index": (k + 1) % len(responsibilities)}],
        }
        for k, (name, cat) in enumerate(off["preferred"])
    ]
    return {
        "schemaVersion": "1",
        "title": off["title"],
        "alternateTitles": [arch["title"]],
        "domain": arch["offer_domain"],
        "contractType": CONTRACT_SNAKE[off["contract"]],
        "workTime": "full_time" if off["employment"] == "Full-time" else "part_time",
        "seniority": off["seniority"],
        "workMode": {"Remote": "remote", "Hybrid": "hybrid", "On-site": "on_site"}[off["work_mode"]],
        "location": {"city": off["city"], "country": off["country"]},
        "salary": {
            "min": float(off["salary_min"]),
            "max": float(off["salary_max"]),
            "currency": "EUR",
            "period": "year",
        },
        "languages": [
            {"name": LANG_NAMES.get(sym, sym), "level": lvl, "required": req} for sym, lvl, req in off["languages"]
        ],
        "summary": f"{off['title']} role at {rc['company']} focusing on {arch['offer_domain']}.",
        "companyPitch": rc["company_desc"],
        "description": off["description_plain"],
        "responsibilities": responsibilities,
        "requiredSkills": req_skills,
        "preferredSkills": pref_skills,
        "benefits": BENEFITS[:3],
    }


# --- main -------------------------------------------------------------------------


def generate_all() -> tuple[list[dict], list[dict], list[dict]]:
    rng = random.Random(RNG_SEED)
    candidates = [generate_candidate(i, rng) for i in range(N_CANDIDATES)]
    recruiters = generate_recruiters(rng)
    offers = [generate_offer(o, recruiters, rng) for o in range(N_OFFERS)]
    return candidates, recruiters, offers


def emit_seed(candidates: list[dict], recruiters: list[dict], offers: list[dict]) -> str:
    rng = random.Random(RNG_SEED + 1)
    out: list[str] = [
        "-- LinQOrbit dev seed (SIMULATION — not a Flyway migration)",
        "-- Generated by scripts/seed/generate.py — password for every seeded account: seed1234",
        "BEGIN;",
        "",
    ]
    for c in candidates:
        out.extend(emit_candidate(c, rng))
    out.append("")
    for rc in recruiters:
        out.extend(emit_recruiter(rc))
    out.append("")
    for off in offers:
        out.extend(emit_offer(off))
    out.extend(["", "COMMIT;", ""])
    return "\n".join(out)


def emit_down(candidates: list[dict], recruiters: list[dict], offers: list[dict]) -> str:
    cand_ids = ",".join(q(c["user_id"]) for c in candidates)
    np_cand = ",".join(q(c["np_id"]) for c in candidates)
    np_off = ",".join(q(off["np_id"]) for off in offers)
    offer_ids = ",".join(q(off["offer_id"]) for off in offers)
    rec_ids = ",".join(q(rc["user_id"]) for rc in recruiters)
    comp_ids = ",".join(q(rc["company_id"]) for rc in recruiters)
    lines = [
        "-- LinQOrbit dev seed cleanup (deterministic ids from generate.py)",
        "BEGIN;",
        f"DELETE FROM normalization_job WHERE job_id IN ({np_cand}) OR job_id IN ({np_off});",
        f"DELETE FROM normalized_profile_candidate WHERE normalized_profile_id IN ({np_cand});",
        f"DELETE FROM normalized_profile_job_offer WHERE normalized_profile_id IN ({np_off});",
        f"DELETE FROM normalized_profile WHERE normalized_profile_id IN ({np_cand}) OR normalized_profile_id IN ({np_off});",
        f"DELETE FROM job_offer_skill WHERE job_offer_id IN ({offer_ids});",
        f"DELETE FROM job_offer_language WHERE job_offer_id IN ({offer_ids});",
        f"DELETE FROM job_offer_degree WHERE job_offer_id IN ({offer_ids});",
        f"DELETE FROM job_offer_study_field WHERE job_offer_id IN ({offer_ids});",
        f"DELETE FROM job_offer WHERE id IN ({offer_ids});",
        f"DELETE FROM company_members WHERE company_id IN ({comp_ids});",
        f"DELETE FROM companies WHERE id IN ({comp_ids});",
        f"DELETE FROM candidate_skills WHERE candidate_id IN ({cand_ids});",
        f"DELETE FROM candidate_languages WHERE candidate_id IN ({cand_ids});",
        f"DELETE FROM professional_experiences WHERE candidate_id IN ({cand_ids});",
        f"DELETE FROM candidate_projects WHERE candidate_id IN ({cand_ids});",
        f"DELETE FROM diplomas WHERE candidate_id IN ({cand_ids});",
        f"DELETE FROM candidate_links WHERE candidate_id IN ({cand_ids});",
        f"DELETE FROM candidates WHERE id IN ({cand_ids});",
        f"DELETE FROM recruiters WHERE id IN ({rec_ids});",
        f"DELETE FROM users WHERE id IN ({cand_ids}) OR id IN ({rec_ids});",
        "COMMIT;",
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="LinQOrbit dev seed generator (simulation only)")
    parser.add_argument("--down", action="store_true", help="emit cleanup SQL instead of seed SQL")
    args = parser.parse_args()

    candidates, recruiters, offers = generate_all()
    if args.down:
        sys.stdout.write(emit_down(candidates, recruiters, offers))
    else:
        sys.stdout.write(emit_seed(candidates, recruiters, offers))


if __name__ == "__main__":
    main()
