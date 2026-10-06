-- P2: skill categories (English display labels) + curated vocabulary enrichment.
-- Categories are VARCHAR(50) labels shown by the UI and grouped in the parse
-- context sent to the AI service. No index: the table stays small (<250 rows)
-- and is always read as a whole.

ALTER TABLE skills ADD COLUMN category VARCHAR(50);

-- Recategorize the 60 seeded skills (rows left NULL fail the NOT NULL below).
UPDATE skills SET category = 'Programming Languages' WHERE name IN (
  'CSS', 'HTML', 'Java', 'JavaScript', 'Python', 'TypeScript'
);
UPDATE skills SET category = 'Frameworks & Libraries' WHERE name IN (
  'Angular', 'Django', 'Flask', 'GraphQL', 'Hibernate', 'Microservices',
  'Next.js', 'Node.js', 'React', 'REST APIs', 'Spring Boot', 'Tailwind CSS', 'Vue.js'
);
UPDATE skills SET category = 'Databases' WHERE name IN (
  'Elasticsearch', 'MongoDB', 'MySQL', 'PostgreSQL', 'Redis', 'SQL'
);
UPDATE skills SET category = 'Cloud & DevOps' WHERE name IN (
  'AWS', 'Azure', 'CI/CD', 'Docker', 'Git', 'Google Cloud', 'Jenkins',
  'Kafka', 'Kubernetes', 'Linux', 'Maven', 'RabbitMQ', 'Terraform'
);
UPDATE skills SET category = 'Data & AI' WHERE name IN ('PyTorch');
UPDATE skills SET category = 'Software' WHERE name IN ('Selenium');
UPDATE skills SET category = 'Soft Skills' WHERE name IN (
  'Adaptability', 'Analytical skills', 'Attention to detail', 'Autonomy',
  'Collaboration', 'Communication', 'Conflict resolution', 'Creativity',
  'Critical thinking', 'Curiosity', 'Customer focus', 'Decision making',
  'Leadership', 'Mentoring', 'Negotiation', 'Presentation skills',
  'Problem solving', 'Stress management', 'Teamwork', 'Time management'
);

-- Canonical wording: CVs write both "Kafka" and "Apache Kafka".
UPDATE skills SET name = 'Apache Kafka' WHERE name = 'Kafka';

ALTER TABLE skills ALTER COLUMN category SET NOT NULL;

-- Curated enrichment (166 entries), grouped by category. skill_type follows
-- SkillType: 1 = TECH, 2 = SOFT. Ids are random: nothing references them yet.
INSERT INTO skills (id, name, skill_type, category)
SELECT gen_random_uuid(), v.name, v.skill_type::smallint, v.category
FROM (VALUES
  -- Programming Languages (16)
  ('C', 1, 'Programming Languages'),
  ('C++', 1, 'Programming Languages'),
  ('C#', 1, 'Programming Languages'),
  ('Go', 1, 'Programming Languages'),
  ('Rust', 1, 'Programming Languages'),
  ('Kotlin', 1, 'Programming Languages'),
  ('Swift', 1, 'Programming Languages'),
  ('Ruby', 1, 'Programming Languages'),
  ('PHP', 1, 'Programming Languages'),
  ('Scala', 1, 'Programming Languages'),
  ('R', 1, 'Programming Languages'),
  ('MATLAB', 1, 'Programming Languages'),
  ('Bash', 1, 'Programming Languages'),
  ('Dart', 1, 'Programming Languages'),
  ('Perl', 1, 'Programming Languages'),
  ('Lua', 1, 'Programming Languages'),
  -- Frameworks & Libraries (15)
  ('Express.js', 1, 'Frameworks & Libraries'),
  ('Svelte', 1, 'Frameworks & Libraries'),
  ('Nuxt.js', 1, 'Frameworks & Libraries'),
  ('.NET', 1, 'Frameworks & Libraries'),
  ('ASP.NET Core', 1, 'Frameworks & Libraries'),
  ('Laravel', 1, 'Frameworks & Libraries'),
  ('Symfony', 1, 'Frameworks & Libraries'),
  ('Ruby on Rails', 1, 'Frameworks & Libraries'),
  ('FastAPI', 1, 'Frameworks & Libraries'),
  ('Flutter', 1, 'Frameworks & Libraries'),
  ('React Native', 1, 'Frameworks & Libraries'),
  ('Redux', 1, 'Frameworks & Libraries'),
  ('RxJS', 1, 'Frameworks & Libraries'),
  ('jQuery', 1, 'Frameworks & Libraries'),
  ('Electron', 1, 'Frameworks & Libraries'),
  -- Databases (10)
  ('Oracle', 1, 'Databases'),
  ('SQLite', 1, 'Databases'),
  ('Microsoft SQL Server', 1, 'Databases'),
  ('MariaDB', 1, 'Databases'),
  ('Cassandra', 1, 'Databases'),
  ('DynamoDB', 1, 'Databases'),
  ('Neo4j', 1, 'Databases'),
  ('Couchbase', 1, 'Databases'),
  ('Firestore', 1, 'Databases'),
  ('Supabase', 1, 'Databases'),
  -- Cloud & DevOps (11)
  ('Ansible', 1, 'Cloud & DevOps'),
  ('Prometheus', 1, 'Cloud & DevOps'),
  ('Grafana', 1, 'Cloud & DevOps'),
  ('Nginx', 1, 'Cloud & DevOps'),
  ('Helm', 1, 'Cloud & DevOps'),
  ('OpenShift', 1, 'Cloud & DevOps'),
  ('VMware', 1, 'Cloud & DevOps'),
  ('Cloudflare', 1, 'Cloud & DevOps'),
  ('Vercel', 1, 'Cloud & DevOps'),
  ('GitHub Actions', 1, 'Cloud & DevOps'),
  ('GitLab CI', 1, 'Cloud & DevOps'),
  -- Data & AI (18)
  ('TensorFlow', 1, 'Data & AI'),
  ('scikit-learn', 1, 'Data & AI'),
  ('Keras', 1, 'Data & AI'),
  ('NLTK', 1, 'Data & AI'),
  ('spaCy', 1, 'Data & AI'),
  ('Hugging Face', 1, 'Data & AI'),
  ('LangChain', 1, 'Data & AI'),
  ('Apache Spark', 1, 'Data & AI'),
  ('Apache Airflow', 1, 'Data & AI'),
  ('Hadoop', 1, 'Data & AI'),
  ('Databricks', 1, 'Data & AI'),
  ('Tableau', 1, 'Data & AI'),
  ('Power BI', 1, 'Data & AI'),
  ('OpenCV', 1, 'Data & AI'),
  ('XGBoost', 1, 'Data & AI'),
  ('Matplotlib', 1, 'Data & AI'),
  ('Seaborn', 1, 'Data & AI'),
  ('Jupyter', 1, 'Data & AI'),
  -- Software (26)
  ('Microsoft Office', 1, 'Software'),
  ('Microsoft Excel', 1, 'Software'),
  ('Microsoft Word', 1, 'Software'),
  ('Microsoft PowerPoint', 1, 'Software'),
  ('Microsoft Outlook', 1, 'Software'),
  ('Microsoft Teams', 1, 'Software'),
  ('SharePoint', 1, 'Software'),
  ('Google Workspace', 1, 'Software'),
  ('Google Sheets', 1, 'Software'),
  ('Jira', 1, 'Software'),
  ('Confluence', 1, 'Software'),
  ('Trello', 1, 'Software'),
  ('Asana', 1, 'Software'),
  ('Slack', 1, 'Software'),
  ('Notion', 1, 'Software'),
  ('Figma', 1, 'Software'),
  ('Adobe Photoshop', 1, 'Software'),
  ('Adobe Illustrator', 1, 'Software'),
  ('Adobe InDesign', 1, 'Software'),
  ('Adobe Premiere Pro', 1, 'Software'),
  ('Adobe After Effects', 1, 'Software'),
  ('IntelliJ IDEA', 1, 'Software'),
  ('VS Code', 1, 'Software'),
  ('Eclipse', 1, 'Software'),
  ('Postman', 1, 'Software'),
  ('AutoCAD', 1, 'Software'),
  -- Design (12)
  ('UI Design', 1, 'Design'),
  ('UX Design', 1, 'Design'),
  ('UX Research', 1, 'Design'),
  ('Wireframing', 1, 'Design'),
  ('Prototyping', 1, 'Design'),
  ('Interaction Design', 1, 'Design'),
  ('Visual Design', 1, 'Design'),
  ('Graphic Design', 1, 'Design'),
  ('Typography', 1, 'Design'),
  ('Branding', 1, 'Design'),
  ('Motion Design', 1, 'Design'),
  ('Design Systems', 1, 'Design'),
  -- Marketing (19)
  ('SEO', 1, 'Marketing'),
  ('SEM', 1, 'Marketing'),
  ('Content Marketing', 1, 'Marketing'),
  ('Email Marketing', 1, 'Marketing'),
  ('Social Media Marketing', 1, 'Marketing'),
  ('Google Analytics', 1, 'Marketing'),
  ('Google Ads', 1, 'Marketing'),
  ('Facebook Ads', 1, 'Marketing'),
  ('Copywriting', 1, 'Marketing'),
  ('Brand Strategy', 1, 'Marketing'),
  ('Market Research', 1, 'Marketing'),
  ('Campaign Management', 1, 'Marketing'),
  ('Marketing Automation', 1, 'Marketing'),
  ('HubSpot', 1, 'Marketing'),
  ('A/B Testing', 1, 'Marketing'),
  ('Influencer Marketing', 1, 'Marketing'),
  ('Video Marketing', 1, 'Marketing'),
  ('Public Relations', 1, 'Marketing'),
  ('Product Marketing', 1, 'Marketing'),
  -- Business & Sales (31)
  ('Sales', 1, 'Business & Sales'),
  ('Business Development', 1, 'Business & Sales'),
  ('Account Management', 1, 'Business & Sales'),
  ('Lead Generation', 1, 'Business & Sales'),
  ('B2B Sales', 1, 'Business & Sales'),
  ('B2C Sales', 1, 'Business & Sales'),
  ('Pipeline Management', 1, 'Business & Sales'),
  ('Cold Calling', 1, 'Business & Sales'),
  ('Territory Management', 1, 'Business & Sales'),
  ('CRM', 1, 'Business & Sales'),
  ('Strategic Planning', 1, 'Business & Sales'),
  ('Business Analysis', 1, 'Business & Sales'),
  ('Market Analysis', 1, 'Business & Sales'),
  ('Competitive Analysis', 1, 'Business & Sales'),
  ('Forecasting', 1, 'Business & Sales'),
  ('Budget Management', 1, 'Business & Sales'),
  ('Vendor Management', 1, 'Business & Sales'),
  ('Stakeholder Management', 1, 'Business & Sales'),
  ('Project Management', 1, 'Business & Sales'),
  ('Agile Methodology', 1, 'Business & Sales'),
  ('Scrum', 1, 'Business & Sales'),
  ('Product Management', 1, 'Business & Sales'),
  ('E-commerce', 1, 'Business & Sales'),
  ('Merchandising', 1, 'Business & Sales'),
  ('Supply Chain Management', 1, 'Business & Sales'),
  ('Logistics', 1, 'Business & Sales'),
  ('Procurement', 1, 'Business & Sales'),
  ('Contract Management', 1, 'Business & Sales'),
  ('Customer Success', 1, 'Business & Sales'),
  ('Upselling', 1, 'Business & Sales'),
  ('Six Sigma', 1, 'Business & Sales'),
  -- Soft Skills (8)
  ('Emotional Intelligence', 2, 'Soft Skills'),
  ('Interpersonal Skills', 2, 'Soft Skills'),
  ('Work Ethic', 2, 'Soft Skills'),
  ('Resilience', 2, 'Soft Skills'),
  ('Cross-functional Collaboration', 2, 'Soft Skills'),
  ('People Management', 2, 'Soft Skills'),
  ('Relationship Building', 2, 'Soft Skills'),
  ('Coaching', 2, 'Soft Skills')
) AS v(name, skill_type, category);
