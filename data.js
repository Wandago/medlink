/* =========================================================
   MEDLINK KE — static catalogue data
   Curriculum, universities, interests and study content that
   ships with the app. Everything users create (profiles, posts,
   resources, messages) lives in Supabase — see app.js.
========================================================= */
// Kenyan medical & health-sciences schools, with which programmes each offers.
// Students elsewhere pick from the worldwide list in data/universities/.
const UNIVERSITIES = [
  { id: "uon",     name: "University of Nairobi",                             abbreviation: "UoN",     location: "Nairobi",  type: "Public"  },
  { id: "moi",     name: "Moi University",                                    abbreviation: "Moi",     location: "Eldoret",  type: "Public"  },
  { id: "ku",      name: "Kenyatta University",                               abbreviation: "KU",      location: "Nairobi",  type: "Public"  },
  { id: "jkuat",   name: "JKUAT",                                             abbreviation: "JKUAT",   location: "Juja",     type: "Public"  },
  { id: "maseno",  name: "Maseno University",                                 abbreviation: "Maseno",  location: "Kisumu",   type: "Public"  },
  { id: "egerton", name: "Egerton University",                                abbreviation: "Egerton", location: "Nakuru",   type: "Public"  },
  { id: "kisii",   name: "Kisii University",                                  abbreviation: "Kisii",   location: "Kisii",    type: "Public"  },
  { id: "mmust",   name: "Masinde Muliro University of Science & Technology",  abbreviation: "MMUST",   location: "Kakamega", type: "Public"  },
  { id: "pwani",   name: "Pwani University",                                  abbreviation: "Pwani",   location: "Kilifi",   type: "Public"  },
  { id: "tum",     name: "Technical University of Mombasa",                   abbreviation: "TUM",     location: "Mombasa",  type: "Public"  },
  { id: "mku",     name: "Mount Kenya University",                            abbreviation: "MKU",     location: "Thika",    type: "Private" },
  { id: "kemu",    name: "Kenya Methodist University",                        abbreviation: "KeMU",    location: "Meru",     type: "Private" },
  { id: "uzima",   name: "Uzima University",                                  abbreviation: "Uzima",   location: "Kisumu",   type: "Private" },
  { id: "aku",     name: "Aga Khan University (Nairobi)",                     abbreviation: "AKU",     location: "Nairobi",  type: "Private" },
  { id: "kmtc",    name: "Kenya Medical Training College",                    abbreviation: "KMTC",    location: "Nationwide", type: "Public" },
];

// Not every institution offers every programme, so the university list is
// derived from the course the student picks first.
//   MBChB      — the full KUCCPS placement list
//   Dentistry  — only UoN and Moi are KMPDC-accredited for BDS
//   Pharmacy   — Pharmacy & Poisons Board approved schools within this list
//   Nursing    — offered across the list
//   Aga Khan   — Medical College (MBChB) and School of Nursing & Midwifery, Nairobi
//   KMTC       — diplomas in nursing, clinical medicine and pharmacy at campuses nationwide
//   Clin. Med. — degree-level programmes; not offered at UoN or JKUAT
const COURSE_UNIVERSITIES = {
  mbchb:     ["uon", "moi", "ku", "jkuat", "maseno", "egerton", "kisii", "mmust", "pwani", "tum", "mku", "kemu", "uzima", "aku"],
  nursing:   ["uon", "moi", "ku", "jkuat", "maseno", "egerton", "kisii", "mmust", "pwani", "tum", "mku", "kemu", "uzima", "aku", "kmtc"],
  clinmed:   ["moi", "ku", "maseno", "egerton", "kisii", "mmust", "pwani", "tum", "mku", "kemu", "uzima", "kmtc"],
  pharmacy:  ["uon", "ku", "jkuat", "maseno", "kisii", "mku", "kemu", "kmtc"],
  dentistry: ["uon", "moi"],
  medlab:    ["uon", "jkuat", "maseno", "mku", "kmtc"],
  physiotherapy: ["uon", "jkuat", "kmTC", "mku"],
  occupational: ["kmtc", "jkuat", "uon"],
  radiography: ["uon", "jkuat", "kmtc", "mku"],
  publichealth: ["uon", "ku", "jkuat", "maseno", "egerton", "mku", "kmtc"],
  communityhealth: ["ku", "maseno", "mmust", "kmtc"],
  nutrition: ["uon", "ku", "jkuat", "egerton", "mku", "kmtc"],
  biomedical: ["uon", "jkuat", "maseno", "kemu"],
  healthinformatics: ["uon", "strathmore", "jkuat", "mku"],
  healthsystems: ["uon", "moi", "aku"],
  healtheconomics: ["uon", "strathmore"],
  epidemiology: ["uon", "moi", "jkuat"],
  environmentalhealth: ["ku", "jkuat", "egerton", "kmtc"],
  occupationalhealth: ["jkuat", "kmtc"],
};
function universitiesForCourse(courseId) {
  const ids = COURSE_UNIVERSITIES[courseId] || COURSE_UNIVERSITIES.mbchb;
  return UNIVERSITIES.filter(u => ids.includes(u.id));
}
function universityOffersCourse(universityId, courseId) {
  return (COURSE_UNIVERSITIES[courseId] || []).includes(universityId);
}
// Programme length differs by course, so the year dropdown is derived from it.
const COURSES = [
  { id: "mbchb",             name: "MBChB",                      years: 6 },
  { id: "nursing",           name: "Nursing",                    years: 4 },
  { id: "clinmed",           name: "Clinical Medicine",          years: 4 },
  { id: "pharmacy",          name: "Pharmacy",                   years: 5 },
  { id: "dentistry",         name: "Dentistry",                  years: 5 },
  { id: "medlab",            name: "Medical Laboratory Science", years: 4 },
  { id: "physiotherapy",     name: "Physiotherapy",              years: 4 },
  { id: "occupational",      name: "Occupational Therapy",       years: 4 },
  { id: "radiography",       name: "Radiography",                years: 4 },
  { id: "publichealth",      name: "Public Health",              years: 4 },
  { id: "communityhealth",   name: "Community Health",           years: 4 },
  { id: "nutrition",         name: "Nutrition and Dietetics",    years: 4 },
  { id: "biomedical",        name: "Biomedical Science",         years: 4 },
  { id: "healthinformatics", name: "Health Informatics",         years: 4 },
  { id: "healthsystems",     name: "Health Systems",             years: 4 },
  { id: "healtheconomics",   name: "Health Economics",           years: 4 },
  { id: "epidemiology",      name: "Epidemiology",               years: 4 },
  { id: "environmentalhealth", name: "Environmental Health",     years: 4 },
  { id: "occupationalhealth",  name: "Occupational Health",      years: 4 },
];
const YEARS = ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6"];
function yearsForCourse(courseId) {
  const c = COURSES.find(x => x.id === courseId);
  return YEARS.slice(0, c ? c.years : 6);
}
/* ---------------------------------------------------------------------
   UNIT CATALOGUE — course > year > semester
   Reflects the typical Kenyan curriculum structure. A student only ever
   sees the units that belong to their own programme and year.
--------------------------------------------------------------------- */
const UNIT_CATALOG = {
  mbchb: {
    "Year 1": {
      "Semester 1": ["Human Anatomy I", "Medical Physiology I", "Medical Biochemistry I", "Histology", "Medical Communication Skills"],
      "Semester 2": ["Human Anatomy II", "Medical Physiology II", "Medical Biochemistry II", "Embryology", "Behavioural Sciences", "Introduction to Community Health"],
    },
    "Year 2": {
      "Semester 1": ["Neuroanatomy", "Systemic Physiology", "Metabolic Biochemistry", "General Pathology", "Medical Microbiology I"],
      "Semester 2": ["Immunology", "Parasitology", "Medical Genetics", "Introduction to Pharmacology", "Community Health & Epidemiology"],
    },
    "Year 3": {
      "Semester 1": ["Systemic Pathology", "Medical Microbiology II", "Pharmacology I", "Haematology", "Clinical Skills & Physical Examination"],
      "Semester 2": ["Pharmacology II", "Forensic Medicine & Toxicology", "Biostatistics & Research Methods", "Introduction to Internal Medicine", "Introduction to Surgery"],
    },
    "Year 4": {
      "Semester 1": ["Internal Medicine", "General Surgery", "Radiology & Imaging", "Anaesthesiology"],
      "Semester 2": ["Obstetrics & Gynaecology", "Paediatrics & Child Health", "Psychiatry", "Community Health Attachment"],
    },
    "Year 5": {
      "Semester 1": ["Internal Medicine (Advanced)", "General Surgery (Advanced)", "Orthopaedics & Trauma", "Ophthalmology"],
      "Semester 2": ["Obstetrics & Gynaecology (Advanced)", "Paediatrics (Advanced)", "Otorhinolaryngology (ENT)", "Dermatology", "Research Project"],
    },
    "Year 6": {
      "Semester 1": ["Internal Medicine Clerkship", "Surgery Clerkship", "Emergency & Critical Care", "Elective Rotation"],
      "Semester 2": ["Obstetrics & Gynaecology Clerkship", "Paediatrics Clerkship", "Community Health Clerkship", "Medical Ethics & Professionalism"],
    },
  },
  nursing: {
    "Year 1": {
      "Semester 1": ["Anatomy & Physiology I", "Fundamentals of Nursing", "Medical Biochemistry", "Nutrition & Dietetics"],
      "Semester 2": ["Anatomy & Physiology II", "Microbiology & Infection Prevention", "Health Assessment", "Communication in Nursing"],
    },
    "Year 2": {
      "Semester 1": ["Medical-Surgical Nursing I", "Pharmacology in Nursing", "Pathophysiology", "Nursing Ethics & Law"],
      "Semester 2": ["Medical-Surgical Nursing II", "Community Health Nursing I", "Epidemiology", "Clinical Practicum I"],
    },
    "Year 3": {
      "Semester 1": ["Midwifery & Reproductive Health", "Paediatric Nursing", "Mental Health Nursing", "Research Methods in Nursing"],
      "Semester 2": ["Advanced Midwifery", "Community Health Nursing II", "Critical Care Nursing", "Clinical Practicum II"],
    },
    "Year 4": {
      "Semester 1": ["Nursing Leadership & Management", "Advanced Critical Care", "Health Systems & Policy", "Research Project"],
      "Semester 2": ["Specialised Clinical Practicum", "Palliative & Oncology Nursing", "Emergency & Disaster Nursing", "Professional Practice"],
    },
  },
  clinmed: {
    "Year 1": {
      "Semester 1": ["Human Anatomy", "Human Physiology", "Biochemistry", "Health Promotion"],
      "Semester 2": ["Medical Microbiology", "Parasitology", "Behavioural Sciences", "Community Diagnosis"],
    },
    "Year 2": {
      "Semester 1": ["General Pathology", "Pharmacology", "Clinical Methods", "Medical Nursing Procedures"],
      "Semester 2": ["Systemic Pathology", "Internal Medicine I", "Community Health", "Epidemiology"],
    },
    "Year 3": {
      "Semester 1": ["Internal Medicine II", "General Surgery", "Obstetrics & Gynaecology", "Emergency Care"],
      "Semester 2": ["Paediatrics & Child Health", "Psychiatry", "Reproductive Health", "Minor Surgical Procedures"],
    },
    "Year 4": {
      "Semester 1": ["Clinical Attachment", "Public Health Practice", "Research Project", "Health Management"],
      "Semester 2": ["Specialty Rotation", "Primary Health Care", "Professional Ethics", "Clinical Audit"],
    },
  },
  pharmacy: {
    "Year 1": {
      "Semester 1": ["Human Anatomy", "Human Physiology", "Pharmaceutical Chemistry I", "Pharmaceutics I"],
      "Semester 2": ["Biochemistry", "Pharmaceutical Chemistry II", "Pharmaceutics II", "Pharmaceutical Calculations"],
    },
    "Year 2": {
      "Semester 1": ["Pharmacology I", "Pharmaceutical Microbiology", "Physical Pharmacy", "Pathophysiology"],
      "Semester 2": ["Pharmacology II", "Pharmacognosy I", "Dosage Form Design", "Medicinal Chemistry"],
    },
    "Year 3": {
      "Semester 1": ["Pharmacology III", "Pharmacognosy II", "Pharmaceutical Technology", "Clinical Biochemistry"],
      "Semester 2": ["Pharmacokinetics", "Pharmaceutical Analysis", "Biopharmaceutics", "Drug Regulatory Affairs"],
    },
    "Year 4": {
      "Semester 1": ["Clinical Pharmacy I", "Pharmacotherapeutics I", "Pharmacy Practice", "Research Methods"],
      "Semester 2": ["Clinical Pharmacy II", "Pharmacotherapeutics II", "Pharmacoepidemiology", "Hospital Pharmacy"],
    },
    "Year 5": {
      "Semester 1": ["Clinical Clerkship", "Pharmaceutical Management", "Research Project", "Toxicology"],
      "Semester 2": ["Industrial Pharmacy Attachment", "Pharmacovigilance", "Health Economics", "Professional Ethics"],
    },
  },
  dentistry: {
    "Year 1": {
      "Semester 1": ["Human Anatomy", "Human Physiology", "Dental Anatomy", "Biochemistry"],
      "Semester 2": ["Head & Neck Anatomy", "Oral Biology", "Dental Materials I", "Behavioural Sciences"],
    },
    "Year 2": {
      "Semester 1": ["Oral Histology", "General Pathology", "Microbiology", "Dental Materials II"],
      "Semester 2": ["Oral Pathology I", "Pharmacology", "Preventive Dentistry", "Dental Radiology"],
    },
    "Year 3": {
      "Semester 1": ["Oral Pathology II", "Periodontology", "Conservative Dentistry", "Prosthodontics I"],
      "Semester 2": ["Oral Medicine", "Endodontics", "Prosthodontics II", "Community Dentistry"],
    },
    "Year 4": {
      "Semester 1": ["Oral & Maxillofacial Surgery I", "Orthodontics", "Paedodontics", "Oral Implantology"],
      "Semester 2": ["Oral & Maxillofacial Surgery II", "Advanced Periodontology", "Research Methods", "Dental Public Health"],
    },
    "Year 5": {
      "Semester 1": ["Clinical Clerkship", "Advanced Restorative Dentistry", "Research Project", "Practice Management"],
      "Semester 2": ["Comprehensive Patient Care", "Oral Surgery Rotation", "Dental Ethics & Jurisprudence", "Elective Rotation"],
    },
  },
  medlab: {
    "Year 1": {
      "Semester 1": ["General Chemistry", "Human Anatomy", "Medical Physiology", "Basic Mathematics"],
      "Semester 2": ["Medical Biochemistry", "Cell Biology", "General Microbiology", "Communication Skills"],
    },
    "Year 2": {
      "Semester 1": ["Clinical Bacteriology", "Haematology I", "Blood Transfusion Science", "Parasitology I"],
      "Semester 2": ["Clinical Chemistry I", "Histopathology I", "Virology", "Mycology"],
    },
    "Year 3": {
      "Semester 1": ["Clinical Chemistry II", "Haematology II", "Histopathology & Cytology II", "Immunology"],
      "Semester 2": ["Molecular Biology", "Laboratory Management & QA", "Research Methods", "Parasitology II"],
    },
    "Year 4": {
      "Semester 1": ["Advanced Laboratory Diagnostics", "Instrumentation & Biosafety", "Clinical Attachment I"],
      "Semester 2": ["Research Project", "Clinical Attachment II", "Professional Ethics"],
    },
  },
  physiotherapy: {
    "Year 1": {
      "Semester 1": ["Human Anatomy I", "Human Physiology I", "Psychology", "Physics for Health Sciences"],
      "Semester 2": ["Human Anatomy II", "Human Physiology II", "Biomechanics I", "Sociology in Health"],
    },
    "Year 2": {
      "Semester 1": ["Kinesiology", "Pathology", "Pharmacology", "Electrotherapy I"],
      "Semester 2": ["Physiotherapy Assessment", "Exercise Therapy", "Electrotherapy II", "Medical Conditions"],
    },
    "Year 3": {
      "Semester 1": ["Musculoskeletal Physiotherapy", "Neurological Physiotherapy", "Cardiopulmonary Physiotherapy", "Research Methods"],
      "Semester 2": ["Paediatric Physiotherapy", "Geriatric Physiotherapy", "Clinical Placement I", "Community Physiotherapy"],
    },
    "Year 4": {
      "Semester 1": ["Advanced Clinical Practice", "Sports Physiotherapy", "Clinical Placement II"],
      "Semester 2": ["Research Project", "Healthcare Management", "Professional Practice"],
    },
  },
  occupational: {
    "Year 1": {
      "Semester 1": ["Human Anatomy", "Human Physiology", "Introduction to Occupational Therapy", "Psychology"],
      "Semester 2": ["Developmental Psychology", "Occupational Science", "Activity Analysis", "Communication Skills"],
    },
    "Year 2": {
      "Semester 1": ["Pathology", "Clinical Conditions in OT", "OT Assessment I", "Kinesiology"],
      "Semester 2": ["Psychosocial Occupational Therapy", "Physical Dysfunction OT", "Ergonomics", "Splinting & Orthotics"],
    },
    "Year 3": {
      "Semester 1": ["Paediatric Occupational Therapy", "Geriatric OT", "Community Based Rehabilitation", "Research Methods"],
      "Semester 2": ["Advanced OT Practice", "Mental Health OT", "Clinical Placement I"],
    },
    "Year 4": {
      "Semester 1": ["Clinical Placement II", "Rehabilitation Technology", "Departmental Management"],
      "Semester 2": ["Research Project", "Clinical Placement III", "Professional Ethics"],
    },
  },
  radiography: {
    "Year 1": {
      "Semester 1": ["Human Anatomy & Physiology I", "Radiation Physics", "General Chemistry", "Mathematics"],
      "Semester 2": ["Human Anatomy & Physiology II", "Radiographic Imaging I", "Apparatus & Equipment", "Computer Science"],
    },
    "Year 2": {
      "Semester 1": ["Radiographic Anatomy", "Radiographic Procedures I", "Radiation Protection & Safety", "Pathology"],
      "Semester 2": ["Radiographic Procedures II", "Digital Imaging & PACS", "Pharmacology in Imaging", "Quality Assurance"],
    },
    "Year 3": {
      "Semester 1": ["Computed Tomography (CT)", "Magnetic Resonance Imaging (MRI)", "Ultrasound Basics", "Research Methods"],
      "Semester 2": ["Radiotherapy Principles", "Nuclear Medicine Basics", "Clinical Practice I"],
    },
    "Year 4": {
      "Semester 1": ["Advanced Imaging Modalities", "Clinical Practice II", "Departmental Management"],
      "Semester 2": ["Research Project", "Clinical Practice III", "Professional Ethics"],
    },
  },
  publichealth: {
    "Year 1": {
      "Semester 1": ["Introduction to Public Health", "Human Anatomy & Physiology", "Biostatistics I", "Environmental Health I"],
      "Semester 2": ["Epidemiology I", "Microbiology & Parasitology", "Sociology & Health", "Health Communication"],
    },
    "Year 2": {
      "Semester 1": ["Biostatistics II", "Epidemiology II", "Environmental Health II", "Nutrition & Health"],
      "Semester 2": ["Maternal & Child Health", "Occupational Health & Safety", "Health Education", "Demography"],
    },
    "Year 3": {
      "Semester 1": ["Health Systems Management", "Health Policy & Economics", "Research Methods", "Vector Control"],
      "Semester 2": ["Public Health Law & Ethics", "Infectious Disease Control", "Chronic Disease Epidemiology", "Field Attachment I"],
    },
    "Year 4": {
      "Semester 1": ["Global Health", "Disaster Management", "Field Attachment II"],
      "Semester 2": ["Research Project", "Project Monitoring & Evaluation", "Strategic Health Planning"],
    },
  },
  communityhealth: {
    "Year 1": {
      "Semester 1": ["Principles of Community Health", "Human Biology", "Social Sciences in Health", "Communication Skills"],
      "Semester 2": ["Primary Health Care", "Basic Epidemiology", "Nutrition in Community", "Environmental Sanitation"],
    },
    "Year 2": {
      "Semester 1": ["Community Diagnosis", "Maternal and Child Health", "Health Education & Promotion", "Infectious Diseases"],
      "Semester 2": ["Community Health Program Management", "Biostatistics Basics", "Field Practical I", "Mental Health in Community"],
    },
    "Year 3": {
      "Semester 1": ["Research Methods", "Health Policy and Advocacy", "Chronic Illness Management", "Field Practical II"],
      "Semester 2": ["Community Mobilization", "Monitoring and Evaluation", "Gerontology", "Reproductive Health"],
    },
    "Year 4": {
      "Semester 1": ["Advanced Community Intervention", "Disaster Preparedness", "Field Attachment"],
      "Semester 2": ["Research Project", "Health Economics for Communities", "Professional Practice"],
    },
  },
  nutrition: {
    "Year 1": {
      "Semester 1": ["Human Anatomy & Physiology", "Basic Chemistry", "Introduction to Human Nutrition", "Food Science I"],
      "Semester 2": ["Biochemistry", "Food Science II", "Microbiology", "Communication Skills"],
    },
    "Year 2": {
      "Semester 1": ["Nutritional Biochemistry", "Meal Planning & Management", "Lifcycle Nutrition I", "Pathophysiology"],
      "Semester 2": ["Lifecycle Nutrition II", "Community Nutrition I", "Nutritional Assessment", "Food Safety & Hygiene"],
    },
    "Year 3": {
      "Semester 1": ["Clinical Nutrition & Dietotherapy I", "Community Nutrition II", "Research Methods", "Dietetic Counselling"],
      "Semester 2": ["Clinical Nutrition & Dietotherapy II", "Institutional Food Service Management", "Public Health Nutrition", "Field Attachment I"],
    },
    "Year 4": {
      "Semester 1": ["Advanced Clinical Dietetics", "Nutritional Epidemiology", "Field Attachment II"],
      "Semester 2": ["Research Project", "Food Policy and Economics", "Professional Ethics in Dietetics"],
    },
  },
  biomedical: {
    "Year 1": {
      "Semester 1": ["Cell Biology", "General Chemistry", "Human Anatomy", "Mathematics for Sciences"],
      "Semester 2": ["Organic Chemistry", "Human Physiology", "Biochemistry I", "Genetics I"],
    },
    "Year 2": {
      "Semester 1": ["Biochemistry II", "General Microbiology", "Genetics II", "Cellular Pathology"],
      "Semester 2": ["Molecular Biology I", "Immunology", "Pharmacology Basics", "Biostatistics"],
    },
    "Year 3": {
      "Semester 1": ["Molecular Biology II", "Recombinant DNA Technology", "Clinical Biochemistry", "Virology"],
      "Semester 2": ["Bioinformatics", "Research Methods", "Toxicology", "Laboratory Techniques"],
    },
    "Year 4": {
      "Semester 1": ["Advanced Biomedical Research", "Clinical Immunology", "Industrial Attachment"],
      "Semester 2": ["Research Project", "Biomedical Ethics", "Emerging Infectious Diseases"],
    },
  },
  healthinformatics: {
    "Year 1": {
      "Semester 1": ["Introduction to IT", "Human Anatomy & Physiology", "Mathematics & Statistics", "Communication Skills"],
      "Semester 2": ["Database Systems", "Programming Basics", "Health Systems Overview", "Health Records Management"],
    },
    "Year 2": {
      "Semester 1": ["Clinical Data Structures", "Healthcare Information Systems", "Object-Oriented Programming", "Networking Basics"],
      "Semester 2": ["Electronic Medical Records (EMR)", "Health Data Standards & Interoperability", "Data Security & Privacy", "Web Technologies"],
    },
    "Year 3": {
      "Semester 1": ["Health Data Analytics", "Decision Support Systems", "Research Methods", "Mobile Health (mHealth)"],
      "Semester 2": ["Telemedicine", "IT Project Management", "Clinical Workflow Analysis", "Industrial Attachment I"],
    },
    "Year 4": {
      "Semester 1": ["Advanced Health Informatics", "Cloud Computing in Healthcare", "Industrial Attachment II"],
      "Semester 2": ["Research Project", "Health Informatics Policy", "Entrepreneurship"],
    },
  },
  healthsystems: {
    "Year 1": {
      "Semester 1": ["Introduction to Health Systems", "Public Health Principles", "Sociology of Health", "Basic Statistics"],
      "Semester 2": ["Health Policy Analysis", "Primary Health Care", "Epidemiology Basics", "Communication Skills"],
    },
    "Year 2": {
      "Semester 1": ["Health Organization Management", "Human Resources for Health", "Health Financing", "Health Economics I"],
      "Semester 2": ["Health Sector Reform", "Quality Improvement in Healthcare", "Supply Chain Management", "Research Methods"],
    },
    "Year 3": {
      "Semester 1": ["Strategic Planning in Health", "Health Law and Governance", "Comparative Health Systems", "Monitoring & Evaluation"],
      "Semester 2": ["Global Health Diplomacy", "Health Systems Research", "Field Attachment I"],
    },
    "Year 4": {
      "Semester 1": ["Leadership in Health", "Field Attachment II", "Advanced Health Policy"],
      "Semester 2": ["Research Project", "Health Systems Crisis Management", "Professional Practice"],
    },
  },
  healtheconomics: {
    "Year 1": {
      "Semester 1": ["Microeconomics I", "Macroeconomics I", "Mathematics for Economists", "Introduction to Health Systems"],
      "Semester 2": ["Microeconomics II", "Statistics for Economists", "Health Economics Foundations", "Public Sector Economics"],
    },
    "Year 2": {
      "Semester 1": ["Econometrics I", "Healthcare Financing & Insurance", "Demand and Supply of Health", "Economic Evaluation I"],
      "Semester 2": ["Econometrics II", "Economic Evaluation II (Cost-Effectiveness)", "Pharmaceutical Economics", "Research Methods"],
    },
    "Year 3": {
      "Semester 1": ["Health Policy and Market Failure", "Applied Health Econometrics", "Hospital Economics", "Field Attachment I"],
      "Semester 2": ["Global Health Economics", "Behavioral Health Economics", "Resource Allocation in Healthcare"],
    },
    "Year 4": {
      "Semester 1": ["Advanced Health Economic Evaluation", "Field Attachment II"],
      "Semester 2": ["Research Project", "Health Policy Workshop", "Professional Practice"],
    },
  },
  epidemiology: {
    "Year 1": {
      "Semester 1": ["Introduction to Epidemiology", "Biostatistics I", "Human Biology", "Public Health Principles"],
      "Semester 2": ["Epidemiological Methods", "Biostatistics II", "Infectious Disease Epidemiology", "Data Management"],
    },
    "Year 2": {
      "Semester 1": ["Advanced Epidemiological Study Designs", "Chronic Disease Epidemiology", "Outbreak Investigation", "SAS/R for Epidemiology"],
      "Semester 2": ["Environmental & Occupational Epidemiology", "Molecular Epidemiology", "Clinical Trials", "Research Methods"],
    },
    "Year 3": {
      "Semester 1": ["Spatial Epidemiology", "Surveillance Systems", "Maternal & Child Epidemiology", "Field Attachment I"],
      "Semester 2": ["Advanced Biostatistics", "Meta-Analysis", "Global Health Surveillance"],
    },
    "Year 4": {
      "Semester 1": ["Epidemiological Modeling", "Field Attachment II"],
      "Semester 2": ["Research Project", "Epidemiology Policy Translation", "Professional Practice"],
    },
  },
  environmentalhealth: {
    "Year 1": {
      "Semester 1": ["Introduction to Environmental Health", "Human Anatomy & Physiology", "General Chemistry", "Mathematics"],
      "Semester 2": ["Environmental Chemistry", "Microbiology & Parasitology", "Environmental Physics", "Communication Skills"],
    },
    "Year 2": {
      "Semester 1": ["Water Supply & Treatment", "Liquid & Solid Waste Management", "Air Pollution & Control", "Epidemiology"],
      "Semester 2": ["Food Hygiene & Safety", "Vector & Pest Control", "Occupational Health & Safety", "Biostatistics"],
    },
    "Year 3": {
      "Semester 1": ["Environmental Impact Assessment (EIA)", "Toxicology", "Housing & Public Health", "Research Methods"],
      "Semester 2": ["Occupational Hygiene", "Disaster Risk Management", "Field Attachment I"],
    },
    "Year 4": {
      "Semester 1": ["Advanced Environmental Law & Ethics", "Field Attachment II", "Project Management"],
      "Semester 2": ["Research Project", "Sustainable Development", "Professional Practice"],
    },
  },
  occupationalhealth: {
    "Year 1": {
      "Semester 1": ["Introduction to Occupational Health & Safety", "Human Anatomy & Physiology", "Physics", "Chemistry"],
      "Semester 2": ["Industrial Psychology", "Microbiology", "Basic Statistics", "Communication Skills"],
    },
    "Year 2": {
      "Semester 1": ["Occupational Hygiene I (Physical Hazards)", "Ergonomics I", "Toxicology", "Pathology"],
      "Semester 2": ["Occupational Hygiene II (Chemical & Biological Hazards)", "Ergonomics II", "Safety Engineering Principles", "Epidemiology"],
    },
    "Year 3": {
      "Semester 1": ["Occupational Diseases & Medicine", "Safety Management Systems", "Research Methods", "Field Attachment I"],
      "Semester 2": ["Environmental & Workplace Compliance", "Emergency Response Planning", "Risk Assessment"],
    },
    "Year 4": {
      "Semester 1": ["Advanced OHS Management", "Field Attachment II", "Labour Laws & Ethics"],
      "Semester 2": ["Research Project", "Auditing OHS Systems", "Professional Practice"],
    },
  },
};

// Units for a given course + year, as a flat list (semester-grouped view is
// built in the UI from unitsBySemester()).
function unitsBySemester(courseId, year) {
  const course = UNIT_CATALOG[courseId] || UNIT_CATALOG.mbchb;
  return course[year] || {};
}
function unitsForYear(courseId, year) {
  return Object.values(unitsBySemester(courseId, year)).flat();
}
// Which semester a unit belongs to — used to label the Current Units page.
function semesterOfUnit(courseId, year, unitName) {
  const groups = unitsBySemester(courseId, year);
  for (const [sem, list] of Object.entries(groups)) if (list.includes(unitName)) return sem;
  return "This semester";
}

/* ---------------------------------------------------------------------
   INTEREST CATALOGUE — grouped so a long list stays scannable
--------------------------------------------------------------------- */
const INTEREST_CATALOG = {
  "Clinical specialties": [
    "Internal Medicine", "General Surgery", "Paediatrics", "Obstetrics & Gynaecology",
    "Psychiatry", "Emergency Medicine", "Anaesthesia", "Orthopaedics",
    "Dermatology", "Ophthalmology", "ENT", "Radiology", "Pathology", "Family Medicine",
  ],
  "Sub-specialties": [
    "Cardiology", "Neurology", "Neurosurgery", "Oncology", "Infectious Diseases",
    "Nephrology", "Endocrinology", "Neuroscience", "Palliative Care",
  ],
  "Research & public health": [
    "Research", "Public Health", "Epidemiology", "Global Health", "Health Policy",
    "Biostatistics", "Tropical Medicine", "Reproductive Health", "Nutrition",
  ],
  "Beyond the ward": [
    "Medical Education", "Medical Technology", "Health Informatics", "Medical Writing",
    "Health Entrepreneurship", "Sports Medicine", "Mental Health Advocacy", "Medical Ethics",
  ],
};
const ALL_INTERESTS = Object.values(INTEREST_CATALOG).flat();

const RESERVED_USERNAMES = ["admin", "medlink", "support", "root", "moderator", "help", "medlinkke", "official", "staff"];
const AVATAR_COLORS = ["#1A56F0", "#FF7A1A", "#FF4F9A", "#10B39E", "#7B61FF", "#F5A300", "#0EA5E9", "#A66DF5"];

function uniName(id) { const u = UNIVERSITIES.find(x => x.id === id); return u ? u.name : ""; }
function uniAbbr(id) { const u = UNIVERSITIES.find(x => x.id === id); return u ? u.abbreviation : ""; }
// For any profile (Kenyan list or the worldwide list): full name, and a short label for meta lines.
function uniFull(p) { return (p && (uniName(p.university_id) || p.university_name)) || ""; }
function uniLabel(p) {
  const known = p && uniAbbr(p.university_id);
  if (known) return known;
  const name = (p && p.university_name) || "";
  if (name.length <= 24) return name;
  const initials = name.replace(/\(.*?\)/g, "").split(/\s+/)
    .filter(w => /^[A-Z]/.test(w) && !/^(Of|And|The|For|De|Da|Del|La|Le|Du|Des|Y|Et)$/.test(w)).map(w => w[0]).join("");
  return initials.length >= 2 ? initials : name.slice(0, 22) + "…";
}

/* ---------------------------------------------------------------------
   COUNTRIES — ISO 3166-1 codes; names come from the browser (localised).
--------------------------------------------------------------------- */
// "CODE:Name|…" — English names shipped here so every browser can show them.
const COUNTRY_NAMES = Object.fromEntries("AD:Andorra|AE:United Arab Emirates|AF:Afghanistan|AG:Antigua & Barbuda|AI:Anguilla|AL:Albania|AM:Armenia|AO:Angola|AQ:Antarctica|AR:Argentina|AS:American Samoa|AT:Austria|AU:Australia|AW:Aruba|AX:Åland Islands|AZ:Azerbaijan|BA:Bosnia & Herzegovina|BB:Barbados|BD:Bangladesh|BE:Belgium|BF:Burkina Faso|BG:Bulgaria|BH:Bahrain|BI:Burundi|BJ:Benin|BL:St. Barthélemy|BM:Bermuda|BN:Brunei|BO:Bolivia|BQ:Caribbean Netherlands|BR:Brazil|BS:Bahamas|BT:Bhutan|BV:Bouvet Island|BW:Botswana|BY:Belarus|BZ:Belize|CA:Canada|CC:Cocos (Keeling) Islands|CD:Congo - Kinshasa|CF:Central African Republic|CG:Congo - Brazzaville|CH:Switzerland|CI:Côte d’Ivoire|CK:Cook Islands|CL:Chile|CM:Cameroon|CN:China|CO:Colombia|CR:Costa Rica|CU:Cuba|CV:Cape Verde|CW:Curaçao|CX:Christmas Island|CY:Cyprus|CZ:Czechia|DE:Germany|DJ:Djibouti|DK:Denmark|DM:Dominica|DO:Dominican Republic|DZ:Algeria|EC:Ecuador|EE:Estonia|EG:Egypt|EH:Western Sahara|ER:Eritrea|ES:Spain|ET:Ethiopia|FI:Finland|FJ:Fiji|FK:Falkland Islands|FM:Micronesia|FO:Faroe Islands|FR:France|GA:Gabon|GB:United Kingdom|GD:Grenada|GE:Georgia|GF:French Guiana|GG:Guernsey|GH:Ghana|GI:Gibraltar|GL:Greenland|GM:Gambia|GN:Guinea|GP:Guadeloupe|GQ:Equatorial Guinea|GR:Greece|GS:South Georgia & South Sandwich Islands|GT:Guatemala|GU:Guam|GW:Guinea-Bissau|GY:Guyana|HK:Hong Kong SAR China|HM:Heard & McDonald Islands|HN:Honduras|HR:Croatia|HT:Haiti|HU:Hungary|ID:Indonesia|IE:Ireland|IL:Israel|IM:Isle of Man|IN:India|IO:British Indian Ocean Territory|IQ:Iraq|IR:Iran|IS:Iceland|IT:Italy|JE:Jersey|JM:Jamaica|JO:Jordan|JP:Japan|KE:Kenya|KG:Kyrgyzstan|KH:Cambodia|KI:Kiribati|KM:Comoros|KN:St. Kitts & Nevis|KP:North Korea|KR:South Korea|KW:Kuwait|KY:Cayman Islands|KZ:Kazakhstan|LA:Laos|LB:Lebanon|LC:St. Lucia|LI:Liechtenstein|LK:Sri Lanka|LR:Liberia|LS:Lesotho|LT:Lithuania|LU:Luxembourg|LV:Latvia|LY:Libya|MA:Morocco|MC:Monaco|MD:Moldova|ME:Montenegro|MF:St. Martin|MG:Madagascar|MH:Marshall Islands|MK:North Macedonia|ML:Mali|MM:Myanmar (Burma)|MN:Mongolia|MO:Macao SAR China|MP:Northern Mariana Islands|MQ:Martinique|MR:Mauritania|MS:Montserrat|MT:Malta|MU:Mauritius|MV:Maldives|MW:Malawi|MX:Mexico|MY:Malaysia|MZ:Mozambique|NA:Namibia|NC:New Caledonia|NE:Niger|NF:Norfolk Island|NG:Nigeria|NI:Nicaragua|NL:Netherlands|NO:Norway|NP:Nepal|NR:Nauru|NU:Niue|NZ:New Zealand|OM:Oman|PA:Panama|PE:Peru|PF:French Polynesia|PG:Papua New Guinea|PH:Philippines|PK:Pakistan|PL:Poland|PM:St. Pierre & Miquelon|PN:Pitcairn Islands|PR:Puerto Rico|PS:Palestinian Territories|PT:Portugal|PW:Palau|PY:Paraguay|QA:Qatar|RE:Réunion|RO:Romania|RS:Serbia|RU:Russia|RW:Rwanda|SA:Saudi Arabia|SB:Solomon Islands|SC:Seychelles|SD:Sudan|SE:Sweden|SG:Singapore|SH:St. Helena|SI:Slovenia|SJ:Svalbard & Jan Mayen|SK:Slovakia|SL:Sierra Leone|SM:San Marino|SN:Senegal|SO:Somalia|SR:Suriname|SS:South Sudan|ST:São Tomé & Príncipe|SV:El Salvador|SX:Sint Maarten|SY:Syria|SZ:Eswatini|TC:Turks & Caicos Islands|TD:Chad|TF:French Southern Territories|TG:Togo|TH:Thailand|TJ:Tajikistan|TK:Tokelau|TL:Timor-Leste|TM:Turkmenistan|TN:Tunisia|TO:Tonga|TR:Türkiye|TT:Trinidad & Tobago|TV:Tuvalu|TW:Taiwan|TZ:Tanzania|UA:Ukraine|UG:Uganda|UM:U.S. Outlying Islands|US:United States|UY:Uruguay|UZ:Uzbekistan|VA:Vatican City|VC:St. Vincent & Grenadines|VE:Venezuela|VG:British Virgin Islands|VI:U.S. Virgin Islands|VN:Vietnam|VU:Vanuatu|WF:Wallis & Futuna|WS:Samoa|XK:Kosovo|YE:Yemen|YT:Mayotte|ZA:South Africa|ZM:Zambia|ZW:Zimbabwe".split("|").map(x => x.split(":")));
const COUNTRY_CODES = Object.keys(COUNTRY_NAMES);
const UNIVERSITY_COUNT = 10249;   // in data/universities/ (regenerate: node scripts/universities.mjs)
const COUNTRIES_WITH_UNIVERSITIES = 200;
function countryName(code) { return COUNTRY_NAMES[code] || code || ""; }
function countryFlag(code) {
  return /^[A-Z]{2}$/.test(code || "") ? String.fromCodePoint(...[...code].map(c => 0x1F1A5 + c.charCodeAt(0))) : "";
}
// Best guess for a new student: their time zone first, then the browser language.
function guessCountry() {
  try {
    const TZ = {
      "Africa/Nairobi": "KE", "Africa/Lagos": "NG", "Africa/Kampala": "UG", "Africa/Dar_es_Salaam": "TZ", "Africa/Kigali": "RW",
      "Africa/Addis_Ababa": "ET", "Africa/Accra": "GH", "Africa/Johannesburg": "ZA", "Africa/Cairo": "EG", "Africa/Lusaka": "ZM",
      "Africa/Harare": "ZW", "Africa/Juba": "SS", "Africa/Mogadishu": "SO", "Africa/Khartoum": "SD", "Africa/Bujumbura": "BI",
      "Africa/Blantyre": "MW", "Africa/Maputo": "MZ", "Africa/Gaborone": "BW", "Africa/Windhoek": "NA", "Africa/Douala": "CM",
      "Africa/Abidjan": "CI", "Africa/Dakar": "SN", "Africa/Casablanca": "MA", "Africa/Tunis": "TN", "Africa/Algiers": "DZ",
      "Asia/Kolkata": "IN", "Asia/Karachi": "PK", "Asia/Dhaka": "BD", "Asia/Manila": "PH", "Europe/London": "GB",
    };
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (TZ[tz]) return TZ[tz];
    const m = /-([A-Z]{2})$/.exec(navigator.language || "");
    if (m && COUNTRY_CODES.includes(m[1])) return m[1];
  } catch (e) { /* old browser */ }
  return "KE";
}
const universityCache = {};
async function universitiesIn(code) {
  if (!/^[A-Z]{2}$/.test(code || "")) return [];
  if (!universityCache[code]) {
    universityCache[code] = fetch("data/universities/" + code + ".json")
      .then(r => (r.ok ? r.json() : []))
      .catch(() => []);
  }
  return universityCache[code];
}
function universitySlug(code, name) {
  return code.toLowerCase() + ":" + String(name).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
function courseName(id) { const c = COURSES.find(x => x.id === id); return c ? c.name : ""; }
function initials(name) { return (name || "").trim().split(/\s+/).map(n => n[0]).join("").slice(0, 2).toUpperCase(); }

const SAMPLE_QUIZ = [
  { q: "Which nerve root most commonly contributes to Erb's palsy following a brachial plexus injury?",
    options: ["C5–C6", "C8–T1", "C7 only", "T1–T2"], correct: 0,
    explain: "Erb's palsy classically results from injury to the upper trunk (C5–C6), often from excessive lateral neck-to-shoulder separation at birth." },
  { q: "During the cardiac cycle, the second heart sound (S2) corresponds to:",
    options: ["Opening of the AV valves", "Closure of the semilunar valves", "Opening of the semilunar valves", "Closure of the AV valves"], correct: 1,
    explain: "S2 marks the closure of the aortic and pulmonary (semilunar) valves at the start of diastole." },
  { q: "Which enzyme catalyses the committed, rate-limiting step of glycolysis?",
    options: ["Hexokinase", "Phosphofructokinase-1", "Pyruvate kinase", "Aldolase"], correct: 1,
    explain: "PFK-1 catalyses the conversion of fructose-6-phosphate to fructose-1,6-bisphosphate — the committed step of glycolysis." },
];

const NEWS = [
  { id: "n1", title: "Kenya rolls out new national internship placement guidelines for MBChB graduates", src: "Ministry of Health", time: "Today" },
  { id: "n2", title: "WHO flags rising antimicrobial resistance across East Africa", src: "WHO Africa", time: "Yesterday" },
  { id: "n3", title: "New open-access physiology atlas released for African medical schools", src: "AfriMed Ed", time: "2 days ago" },
];

/* ---------------------------------------------------------------------
   USERNAME VALIDATION
--------------------------------------------------------------------- */
const USERNAME_RULES = "3–20 characters: lowercase letters, numbers, periods and underscores only.";
function usernameFormatError(u) {
  if (!u) return "Please choose a username.";
  if (u.length < 3) return "Username must be at least 3 characters.";
  if (u.length > 20) return "Username must be 20 characters or fewer.";
  if (/\s/.test(u)) return "Usernames can't contain spaces.";
  if (!/^[a-z0-9._]+$/.test(u)) return "Only lowercase letters, numbers, periods and underscores are allowed.";
  return null;
}
function suggestUsernames(base, takenSet) {
  const clean = (base || "student").toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 14) || "student";
  const candidates = [`${clean}1`, `${clean}_med`, `${clean}ke`, `${clean}.med`, `${clean}${Math.floor(Math.random() * 90 + 10)}`];
  return candidates.filter(c => !takenSet.has(c)).slice(0, 4);
}

const RESOURCE_TYPES = ["Notes", "Summary", "Past Paper", "MCQ", "Practical Guide", "Slides", "Other"];

/* ---------------------------------------------------------------------
   COLOUR CODING
--------------------------------------------------------------------- */
// Each resource type gets its own bright colour + icon across the app.
const TYPE_STYLES = {
  "Notes":           { color: "#1A56F0", soft: "#E6EEFF", icon: "📘" },
  "Summary":         { color: "#FF7A1A", soft: "#FFF0E3", icon: "⚡" },
  "Past Paper":      { color: "#FF4F9A", soft: "#FFE8F2", icon: "📄" },
  "MCQ":             { color: "#7B61FF", soft: "#EFEBFF", icon: "✅" },
  "Practical Guide": { color: "#10B39E", soft: "#E1F7F3", icon: "🔬" },
  "Slides":          { color: "#F5A300", soft: "#FFF5DB", icon: "📊" },
  "Other":           { color: "#0EA5E9", soft: "#E0F4FD", icon: "📎" },
};
function typeStyle(t) { return TYPE_STYLES[t] || TYPE_STYLES.Other; }

/* ---------------------------------------------------------------------
   SITE IMAGES
   Every photo on the site has a "slot". The defaults below ship in /img
   (free Unsplash photos, see img/CREDITS.md); a super admin can replace
   any slot from admin.html and the change applies site-wide.
--------------------------------------------------------------------- */
const SITE_IMAGES = [
  { slot: "hero-sky",            group: "Landing page", label: "Hero background",            src: "img/hero-sky.jpg",            alt: "Blue sky above the clouds" },
  { slot: "hero-main",           group: "Landing page", label: "About — photo card",         src: "img/hero-main.jpg",           alt: "Medical students reviewing a scan together" },
  { slot: "feature-exams",       group: "Landing page", label: "Features — photo 1",         src: "img/feature-exams.jpg",       alt: "Doctor reading an X-ray" },
  { slot: "feature-communities", group: "Landing page", label: "Features — photo 2",         src: "img/feature-communities.jpg", alt: "Students laughing around a table" },
  { slot: "cta-banner",          group: "Landing page", label: "Closing banner",             src: "img/cta-banner.jpg",          alt: "Graduates celebrating" },
  { slot: "auth-side",           group: "Sign in / sign up", label: "Sign-in & sign-up photo", src: "img/auth-side.jpg",         alt: "Smiling medical student in scrubs" },
  { slot: "onboarding-side",     group: "Sign in / sign up", label: "Onboarding photo",      src: "img/onboarding-side.jpg",     alt: "Student holding a folder" },
  { slot: "dashboard-banner",    group: "Inside the app", label: "Home banner photo",       src: "img/dashboard-banner.jpg",    alt: "Student at a microscope" },
  { slot: "communities-banner",  group: "Inside the app", label: "Communities banner photo", src: "img/hero-study.jpg",          alt: "Students studying together" },
];
const COMMUNITY_IMAGES = {
  "anatomy": "img/community-anatomy.jpg",
  "surgery": "img/community-surgery.jpg",
  "public-health": "img/community-public-health.jpg",
  "med-students-ke": "img/community-med-students-ke.jpg",
  "course-mbchb": "img/community-course-mbchb.jpg",
  "course-nursing": "img/community-course-nursing.jpg",
  "course-clinmed": "img/community-course-clinmed.jpg",
  "course-pharmacy": "img/community-course-pharmacy.jpg",
  "course-dentistry": "img/community-course-dentistry.jpg",
};
const COMMUNITY_FALLBACK_COLORS = ["#1A56F0", "#FF7A1A", "#FF4F9A", "#10B39E", "#7B61FF", "#F5A300"];

/* ---------------------------------------------------------------------
   EXAM BANK
   Subjects offered by the open MedMCQA question bank (Apache-2.0,
   https://huggingface.co/datasets/openlifescienceai/medmcqa), which the
   admin page can import from. "label" is what students see.
--------------------------------------------------------------------- */
const EXAM_SUBJECTS = [
  { id: "Anatomy", label: "Anatomy" },
  { id: "Physiology", label: "Physiology" },
  { id: "Biochemistry", label: "Biochemistry" },
  { id: "Pathology", label: "Pathology" },
  { id: "Pharmacology", label: "Pharmacology" },
  { id: "Microbiology", label: "Microbiology" },
  { id: "Forensic Medicine", label: "Forensic Medicine" },
  { id: "Social & Preventive Medicine", label: "Community Health" },
  { id: "Medicine", label: "Internal Medicine" },
  { id: "Surgery", label: "Surgery" },
  { id: "Gynaecology & Obstetrics", label: "Obstetrics & Gynaecology" },
  { id: "Pediatrics", label: "Paediatrics" },
  { id: "Psychiatry", label: "Psychiatry" },
  { id: "Ophthalmology", label: "Ophthalmology" },
  { id: "ENT", label: "ENT" },
  { id: "Radiology", label: "Radiology" },
  { id: "Anaesthesia", label: "Anaesthesia" },
  { id: "Orthopaedics", label: "Orthopaedics" },
  { id: "Skin", label: "Dermatology" },
  { id: "Dental", label: "Dental" },
];
const SUBJECT_COLORS = ["#1A56F0", "#FF7A1A", "#FF4F9A", "#10B39E", "#7B61FF", "#F5A300", "#0EA5E9"];
function subjectColor(name) {
  let h = 0;
  for (const ch of String(name || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SUBJECT_COLORS[h % SUBJECT_COLORS.length];
}
