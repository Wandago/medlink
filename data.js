/* =========================================================
   MEDLINK KE — shared mock data + helpers
   Loaded before any page-specific <script> tag.
========================================================= */

// The 13 institutions on the KUCCPS placement list for health-sciences
// degrees. Every entry here is placed through KUCCPS.
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
];

// Not every institution offers every programme, so the university list is
// derived from the course the student picks first.
//   MBChB      — the full KUCCPS placement list
//   Dentistry  — only UoN and Moi are KMPDC-accredited for BDS
//   Pharmacy   — Pharmacy & Poisons Board approved schools within this list
//   Nursing    — offered across all 13
//   Clin. Med. — degree-level programmes; not offered at UoN or JKUAT
const COURSE_UNIVERSITIES = {
  mbchb:     ["uon", "moi", "ku", "jkuat", "maseno", "egerton", "kisii", "mmust", "pwani", "tum", "mku", "kemu", "uzima"],
  nursing:   ["uon", "moi", "ku", "jkuat", "maseno", "egerton", "kisii", "mmust", "pwani", "tum", "mku", "kemu", "uzima"],
  clinmed:   ["moi", "ku", "maseno", "egerton", "kisii", "mmust", "pwani", "tum", "mku", "kemu", "uzima"],
  pharmacy:  ["uon", "ku", "jkuat", "maseno", "kisii", "mku", "kemu"],
  dentistry: ["uon", "moi"],
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
  { id: "mbchb",     name: "MBChB",             years: 6 },
  { id: "nursing",   name: "Nursing",           years: 4 },
  { id: "clinmed",   name: "Clinical Medicine", years: 4 },
  { id: "pharmacy",  name: "Pharmacy",          years: 5 },
  { id: "dentistry", name: "Dentistry",         years: 5 },
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
const AVATAR_COLORS = ["#A66DF5", "#FF8B72", "#F0B84C", "#4FBE7E", "#5EC8E0", "#E07BD0"];

function uniName(id) { const u = UNIVERSITIES.find(x => x.id === id); return u ? u.name : ""; }
function uniAbbr(id) { const u = UNIVERSITIES.find(x => x.id === id); return u ? u.abbreviation : ""; }
function courseName(id) { const c = COURSES.find(x => x.id === id); return c ? c.name : ""; }
function initials(name) { return (name || "").trim().split(/\s+/).map(n => n[0]).join("").slice(0, 2).toUpperCase(); }

const SEED_USERS = [
  { id: "u_amina", fullName: "Amina Rashid", username: "aminarashid", universityId: "uon", courseId: "mbchb", year: "Year 1",
    bio: "Trying to survive anatomy block one mnemonic at a time.", interests: ["Neuroscience", "Research"], currentUnits: ["Anatomy", "Physiology"],
    color: "#A66DF5", followingIds: ["u_david", "u_brian"] },
  { id: "u_david", fullName: "David Kamau", username: "davidkmed", universityId: "moi", courseId: "mbchb", year: "Year 1",
    bio: "Sharing my Anatomy notes so no one has to suffer through Netter's alone.", interests: ["Public Health"], currentUnits: ["Anatomy", "Biochemistry"],
    color: "#FF8B72", followingIds: ["u_amina", "u_farah"] },
  { id: "u_faith", fullName: "Faith Njeri", username: "faithnjeri", universityId: "ku", courseId: "nursing", year: "Year 2",
    bio: "Nursing student, night-shift study group organiser.", interests: ["Public Health"], currentUnits: ["Physiology"],
    color: "#F0B84C", followingIds: ["u_grace"] },
  { id: "u_brian", fullName: "Brian Otieno", username: "brianotieno", universityId: "uon", courseId: "mbchb", year: "Year 2",
    bio: "Future neurosurgeon, current caffeine addict.", interests: ["Neurosurgery", "Research"], currentUnits: ["Physiology"],
    color: "#4FBE7E", followingIds: ["u_amina", "u_samuel", "u_farah"] },
  { id: "u_grace", fullName: "Grace Wambui", username: "gracewambui", universityId: "ku", courseId: "nursing", year: "Year 3",
    bio: "Community health placements taught me more than any textbook.", interests: ["Public Health"], currentUnits: ["Biochemistry"],
    color: "#5EC8E0", followingIds: ["u_faith"] },
  { id: "u_samuel", fullName: "Samuel Kones", username: "samkones", universityId: "moi", courseId: "clinmed", year: "Year 1",
    bio: "Clinical medicine, aiming for emergency medicine.", interests: ["Emergency Medicine"], currentUnits: ["Anatomy"],
    color: "#E07BD0", followingIds: [] },
  { id: "u_farah", fullName: "Farah Hassan", username: "farahhassan", universityId: "pwani", courseId: "mbchb", year: "Year 2",
    bio: "Neuroanatomy nerd. Ask me about cranial nerves.", interests: ["Neuroanatomy", "Radiology"], currentUnits: ["Anatomy"],
    color: "#F5A3C7", followingIds: ["u_brian"] },
  { id: "u_wanjiru", fullName: "Wanjiru Karanja", username: "wanjiruk", universityId: "uon", courseId: "mbchb", year: "Year 1",
    bio: "High-yield summaries, made for revision week.", interests: ["Anatomy"], currentUnits: ["Anatomy"],
    color: "#8E7CF0", followingIds: [] },
  { id: "u_achieng", fullName: "Mercy Achieng", username: "achiengm", universityId: "uon", courseId: "mbchb", year: "Year 1",
    bio: "Biochemistry doesn't have to be this hard.", interests: ["Research"], currentUnits: ["Biochemistry"],
    color: "#F0925C", followingIds: [] },
  { id: "u_kiptoo", fullName: "James Kiptoo", username: "jkiptoo", universityId: "ku", courseId: "mbchb", year: "Year 1",
    bio: "Embryology enthusiast — yes, that's a thing.", interests: ["Research"], currentUnits: ["Embryology"],
    color: "#63C2A6", followingIds: [] },
  { id: "u_mutua", fullName: "Peter Mutua", username: "pmutua", universityId: "uon", courseId: "mbchb", year: "Year 2",
    bio: "Practical guides and dissection-week survival tips.", interests: ["Anatomy"], currentUnits: ["Anatomy"],
    color: "#C68CF0", followingIds: [] },
  { id: "u_njeri", fullName: "Alice Njeri", username: "njeria", universityId: "moi", courseId: "mbchb", year: "Year 1",
    bio: "Physiology MCQs are my love language.", interests: ["Physiology"], currentUnits: ["Physiology"],
    color: "#5CA8F0", followingIds: [] },
  { id: "u_odhiambo", fullName: "Kevin Odhiambo", username: "kevodhiambo", universityId: "maseno", courseId: "mbchb", year: "Year 2",
    bio: "MBChB with IT at Maseno — building study tools on the side.", interests: ["Research", "Medical Technology"], currentUnits: ["Physiology"],
    color: "#7C9CF5", followingIds: ["u_amina"] },
  { id: "u_barasa", fullName: "Sharon Barasa", username: "sbarasa", universityId: "mmust", courseId: "mbchb", year: "Year 1",
    bio: "Kakamega-based. Anatomy study group every Tuesday.", interests: ["Anatomy", "Public Health"], currentUnits: ["Anatomy", "Biochemistry"],
    color: "#D98BE0", followingIds: ["u_wanjiru"] },
];

const CURRENT_UNITS = [
  { id: "u1", name: "Anatomy", semester: "Semester 1", members: 214, color: "#A66DF5", unread: 6 },
  { id: "u2", name: "Physiology", semester: "Semester 1", members: 198, color: "#FF8B72", unread: 2 },
  { id: "u3", name: "Biochemistry", semester: "Semester 1", members: 176, color: "#F0B84C", unread: 0 },
];
const ARCHIVED_UNITS = [
  { id: "a1", name: "Histology", term: "Year 1 · Sem 2, 2025", resourcesMoved: 41 },
  { id: "a2", name: "Cell Biology", term: "Year 1 · Sem 1, 2025", resourcesMoved: 27 },
];

const RESOURCES = [
  { id: "r1", title: "Brachial Plexus — High-Yield Summary", unit: "Anatomy", type: "Notes", authorId: "u_wanjiru", views: 1204, saves: 312, date: "3 days ago" },
  { id: "r2", title: "Cardiac Cycle — Revision Notes", unit: "Physiology", type: "Summary", authorId: "u_brian", views: 980, saves: 265, date: "1 week ago" },
  { id: "r3", title: "Glycolysis — Exam Review Pack", unit: "Biochemistry", type: "Summary", authorId: "u_achieng", views: 875, saves: 201, date: "2 weeks ago" },
  { id: "r4", title: "Development of the Heart — Embryology", unit: "Embryology", type: "Notes", authorId: "u_kiptoo", views: 640, saves: 154, date: "4 days ago" },
  { id: "r5", title: "Upper Limb Osteology — Practical Guide", unit: "Anatomy", type: "Practical Guide", authorId: "u_mutua", views: 512, saves: 133, date: "6 days ago" },
  { id: "r6", title: "Renal Physiology — MCQ Set", unit: "Physiology", type: "MCQ", authorId: "u_njeri", views: 701, saves: 190, date: "5 days ago" },
  { id: "r7", title: "Neuroanatomy — Cranial Nerves Made Simple", unit: "Anatomy", type: "Notes", authorId: "u_farah", views: 588, saves: 149, date: "2 days ago" },
  { id: "r8", title: "Acid–Base Balance — One-Page Cheat Sheet", unit: "Physiology", type: "Summary", authorId: "u_odhiambo", views: 433, saves: 118, date: "1 day ago" },
];

const EXAM_SETS = [
  { id: "e1", title: "Anatomy — End of Semester 2024", unit: "Anatomy", questions: 60, university: "University of Nairobi" },
  { id: "e2", title: "Physiology CAT 1 — 2024", unit: "Physiology", questions: 25, university: "Moi University" },
  { id: "e3", title: "Biochemistry — Metabolism MCQs", unit: "Biochemistry", questions: 40, university: "Kenyatta University" },
  { id: "e4", title: "Anatomy — Head & Neck Practical Exam 2024", unit: "Anatomy", questions: 30, university: "Pwani University" },
];

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

const COMMUNITIES = [
  { id: "c1", name: "Anatomy", members: 3120, desc: "High-yield discussions, mnemonics and dissection-week survival tips." },
  { id: "c2", name: "Surgery", members: 1890, desc: "For students on surgical rotations and future surgeons-in-training." },
  { id: "c3", name: "Public Health", members: 1420, desc: "Epidemiology, community health placements and research chats." },
  { id: "c4", name: "Medical Students in Kenya", members: 6840, desc: "The general home base — announcements, opportunities, and banter." },
];

const FEED = [
  { id: "p1", authorId: "u_amina", time: "2h", body: "Can someone explain the corticospinal tract in a way that isn't straight out of the textbook? Lost me at the internal capsule 😅", likes: 34, comments: 12 },
  { id: "p2", authorId: "u_david", time: "5h", body: "Uploaded my full Anatomy summary for the upper limb — free for anyone who wants it before Friday's CAT.", likes: 58, comments: 9 },
  { id: "p3", authorId: "u_faith", time: "1d", body: "Anyone studying tonight for Physiology? Thinking of opening a call around 8pm, cardiac cycle + renal physio.", likes: 21, comments: 15 },
];

const NEWS = [
  { id: "n1", title: "Kenya rolls out new national internship placement guidelines for MBChB graduates", src: "Ministry of Health", time: "Today" },
  { id: "n2", title: "WHO flags rising antimicrobial resistance across East Africa", src: "WHO Africa", time: "Yesterday" },
  { id: "n3", title: "New open-access physiology atlas released for African medical schools", src: "AfriMed Ed", time: "2 days ago" },
];

const SEED_CONVERSATIONS = [
  { id: "m1", userId: "u_david", last: "Sent you the anatomy summary!", time: "10m", unread: 2,
    thread: [{ from: "them", text: "Hey! Did you finish the anatomy summary?" }, { from: "me", text: "Almost — sending it over tonight." }, { from: "them", text: "Sent you the anatomy summary!" }] },
  { id: "m3", userId: "u_grace", last: "Thank you so much, that really helped 🙏", time: "1d", unread: 0,
    thread: [{ from: "me", text: "Here's the community health summary I mentioned." }, { from: "them", text: "Thank you so much, that really helped 🙏" }] },
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

/* ---------------------------------------------------------------------
   PERSISTED STATE (localStorage) — stands in for a backend across pages
--------------------------------------------------------------------- */
const STORE_KEYS = { me: "medlink_me", following: "medlink_following", conversations: "medlink_conversations" };

function getMe() {
  try { return JSON.parse(localStorage.getItem(STORE_KEYS.me)); } catch (e) { return null; }
}
function setMe(user) { localStorage.setItem(STORE_KEYS.me, JSON.stringify(user)); }
function clearSession() {
  localStorage.removeItem(STORE_KEYS.me);
  localStorage.removeItem(STORE_KEYS.following);
  localStorage.removeItem(STORE_KEYS.conversations);
}

function getFollowing() {
  try { return new Set(JSON.parse(localStorage.getItem(STORE_KEYS.following)) || []); } catch (e) { return new Set(); }
}
function saveFollowing(set) { localStorage.setItem(STORE_KEYS.following, JSON.stringify(Array.from(set))); }
function toggleFollow(userId) {
  const me = getMe();
  if (!me || userId === me.id) return getFollowing();
  const set = getFollowing();
  set.has(userId) ? set.delete(userId) : set.add(userId);
  saveFollowing(set);
  return set;
}

function getConversations() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORE_KEYS.conversations));
    return stored && stored.length ? stored : SEED_CONVERSATIONS;
  } catch (e) { return SEED_CONVERSATIONS; }
}
function saveConversations(list) { localStorage.setItem(STORE_KEYS.conversations, JSON.stringify(list)); }
function startConversation(userId) {
  const list = getConversations();
  let convo = list.find(c => c.userId === userId);
  if (!convo) {
    convo = { id: `m_${userId}`, userId, last: "", time: "now", unread: 0, thread: [] };
    list.unshift(convo);
    saveConversations(list);
  }
  return convo.id;
}
function sendMessage(convId, text) {
  const list = getConversations();
  const idx = list.findIndex(c => c.id === convId);
  if (idx === -1) return list;
  list[idx] = { ...list[idx], thread: [...list[idx].thread, { from: "me", text }], last: text, time: "now", unread: 0 };
  saveConversations(list);
  return list;
}
function goToMessage(userId) {
  const id = startConversation(userId);
  sessionStorage.setItem("medlink_open_conv_hint", id);
  window.location.href = "messages.html";
}

function allUsers() {
  const me = getMe();
  return me ? [...SEED_USERS, me] : SEED_USERS.slice();
}
function getUserByUsername(username) { return allUsers().find(u => u.username === username); }
function getUserById(id) { return allUsers().find(u => u.id === id); }

function getFollowerCount(userId) {
  const me = getMe();
  const users = allUsers();
  const myFollowing = getFollowing();
  let count = users.filter(u => u.id !== userId && (!me || u.id !== me.id) && (u.followingIds || []).includes(userId)).length;
  if (me && userId !== me.id && myFollowing.has(userId)) count += 1;
  return count;
}
function getFollowingCount(user) {
  const me = getMe();
  if (me && user.id === me.id) return getFollowing().size;
  return (user.followingIds || []).length;
}

function requireSession() {
  if (!getMe()) { window.location.href = "index.html"; return false; }
  return true;
}

/* ---------------------------------------------------------------------
   SMALL DOM HELPERS
--------------------------------------------------------------------- */
function el(tag, attrs, children) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  (children || []).forEach(c => node.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
  return node;
}
function qs(sel, root) { return (root || document).querySelector(sel); }
function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
function escapeHtml(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

/* ---------------------------------------------------------------------
   SHARED CHROME — top bar avatar + profile links, run on every app page
--------------------------------------------------------------------- */
function initShellChrome() {
  const me = getMe();
  if (!me) return;
  const avatarLink = qs("#topbarAvatar");
  if (avatarLink) {
    avatarLink.href = `profile.html?u=${encodeURIComponent(me.username)}`;
    avatarLink.className = "avatar avatar-link";
    avatarLink.style.background = me.color;
    avatarLink.textContent = initials(me.fullName);
  }
  const searchForm = qs("#topbarSearchForm");
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      const input = qs("input", searchForm);
      if (!input.value.trim()) e.preventDefault();
    });
  }
  qsa("[data-profile-link]").forEach(a => { a.href = `profile.html?u=${encodeURIComponent(me.username)}`; });
}
document.addEventListener("DOMContentLoaded", initShellChrome);

/* ---------------------------------------------------------------------
   SHARED RENDER HELPERS — reused across Home, Study, Discover, Profile…
--------------------------------------------------------------------- */
function resourceCardNode(resource) {
  const author = getUserById(resource.authorId);
  const card = el("div", { class: "card resource-card" });
  card.innerHTML = `
    <div class="top-row"><span class="chip">${escapeHtml(resource.type)}</span><span style="opacity:.45;font-size:15px;">📄</span></div>
    <div class="title">${escapeHtml(resource.title)}</div>
    <div class="meta">${escapeHtml(resource.unit)} · ${author ? escapeHtml(uniName(author.universityId)) : ""}</div>
    <div class="bottom-row">
      <span class="author-link">${author ? escapeHtml(author.fullName) + ' <span style="color:var(--violet-dark)">@' + escapeHtml(author.username) + '</span>' : "MedLink student"}</span>
      <span>🔖 ${resource.saves}</span>
    </div>`;
  card.addEventListener("click", (e) => {
    if (e.target.closest(".author-link") && author) {
      window.location.href = `profile.html?u=${encodeURIComponent(author.username)}`;
      return;
    }
    window.location.href = `resource.html?id=${resource.id}`;
  });
  return card;
}

function feedPostNode(post) {
  const author = getUserById(post.authorId);
  const card = el("div", { class: "card post-card" });
  card.innerHTML = `
    <div class="post-author-row">
      <div class="avatar" style="background:${author ? author.color : "#A66DF5"}">${author ? initials(author.fullName) : "?"}</div>
      <div class="post-name-row"><span class="post-name">${author ? escapeHtml(author.fullName) : "Unknown"}</span><span class="post-handle">@${author ? escapeHtml(author.username) : ""}</span></div>
    </div>
    <div class="post-meta">${author ? escapeHtml(courseName(author.courseId) + " · " + author.year + " · " + uniAbbr(author.universityId)) : ""} · ${escapeHtml(post.time)}</div>
    <div class="post-body">${escapeHtml(post.body)}</div>
    <div class="post-actions"><span>❤️ ${post.likes}</span><span>💬 ${post.comments}</span><span>↗ Share</span></div>`;
  qs(".post-author-row", card).addEventListener("click", () => {
    if (author) window.location.href = `profile.html?u=${encodeURIComponent(author.username)}`;
  });
  return card;
}

function studentRowNode(user) {
  const me = getMe();
  const isMe = me && user.id === me.id;
  const following = getFollowing();
  const row = el("div", { class: "card pad", style: "display:flex;gap:10px;align-items:center;" });
  row.innerHTML = `
    <div class="row-gap follow-row-click" style="flex:1;cursor:pointer;min-width:0;">
      <div class="avatar" style="background:${user.color}">${initials(user.fullName)}</div>
      <div style="min-width:0;overflow:hidden;">
        <div style="font-weight:700;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(user.fullName)}</div>
        <div style="font-size:12px;color:var(--violet-dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">@${escapeHtml(user.username)}</div>
        <div class="faint" style="font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(courseName(user.courseId))} · ${escapeHtml(user.year)} · ${escapeHtml(uniAbbr(user.universityId))}</div>
      </div>
    </div>
    ${isMe ? "" : `<button class="btn btn-ghost btn-sm follow-btn" style="flex-shrink:0;">${following.has(user.id) ? "Following" : "Follow"}</button>`}
  `;
  qs(".follow-row-click", row).addEventListener("click", () => {
    window.location.href = `profile.html?u=${encodeURIComponent(user.username)}`;
  });
  const followBtn = qs(".follow-btn", row);
  if (followBtn) {
    followBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const set = toggleFollow(user.id);
      followBtn.textContent = set.has(user.id) ? "Following" : "Follow";
    });
  }
  return row;
}
