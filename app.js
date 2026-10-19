/**
 * MedLink - Telehealth & Clinic System
 * Lightweight, accessible, offline-friendly medical portal
 */

// Sample verified doctors dataset
const DOCTORS_DATA = [
  {
    id: 1,
    name: "Dr. Amina Ochieng",
    avatar: "👩🏾‍⚕️",
    specialty: "Pediatrics",
    rating: 4.9,
    reviews: 320,
    hospital: "Aga Khan University Hospital / Telehealth",
    fee: "$8 / 1,000 KES",
    isOnline: true,
    availableToday: true,
    experience: "12 yrs exp",
    languages: "English, Swahili"
  },
  {
    id: 2,
    name: "Dr. Kwesi Mensah",
    avatar: "👨🏾‍⚕️",
    specialty: "General Practitioner",
    rating: 4.8,
    reviews: 195,
    hospital: "Korle Bu Teaching Clinic",
    fee: "$6 / 750 KES",
    isOnline: true,
    availableToday: true,
    experience: "8 yrs exp",
    languages: "English, Twi, Ga"
  },
  {
    id: 3,
    name: "Dr. Fatima Zahra",
    avatar: "🧕🏽",
    specialty: "Obstetrics & Gynae",
    rating: 4.9,
    reviews: 240,
    hospital: "Nairobi Women's Health Pavilion",
    fee: "$12 / 1,500 KES",
    isOnline: false,
    availableToday: true,
    experience: "14 yrs exp",
    languages: "English, Arabic, Swahili"
  },
  {
    id: 4,
    name: "Dr. Samuel Adeyemi",
    avatar: "👨🏿‍⚕️",
    specialty: "Cardiology",
    rating: 4.9,
    reviews: 154,
    hospital: "Lagos Heart & Vascular Institute",
    fee: "$15 / 1,900 KES",
    isOnline: true,
    availableToday: false,
    experience: "16 yrs exp",
    languages: "English, Yoruba"
  },
  {
    id: 5,
    name: "Dr. Grace Muthoni",
    avatar: "👩🏿‍⚕️",
    specialty: "Dermatology",
    rating: 4.7,
    reviews: 98,
    hospital: "Kenyatta National Referral Tele-care",
    fee: "$9 / 1,150 KES",
    isOnline: false,
    availableToday: true,
    experience: "9 yrs exp",
    languages: "English, Swahili"
  },
  {
    id: 6,
    name: "Dr. Tariq Ndlovu",
    avatar: "👨🏽‍⚕️",
    specialty: "Mental Health",
    rating: 5.0,
    reviews: 112,
    hospital: "Cape Town Wellness Center",
    fee: "$10 / 1,250 KES",
    isOnline: true,
    availableToday: true,
    experience: "11 yrs exp",
    languages: "English, Zulu, Xhosa"
  }
];

// App State Management with LocalStorage
const STORAGE_KEYS = {
  APPOINTMENTS: 'medlink_appointments_v1',
  PRESCRIPTIONS: 'medlink_prescriptions_v1'
};

let appointments = [];
let prescriptions = [];
let callIntervalTimer = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  loadStoredData();
  renderDoctors(DOCTORS_DATA);
  renderPrescriptions();
  updateAppointmentBadge();
  setupEventListeners();

  // Set year in footer
  const yearSpan = document.getElementById('currentYear');
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  // Set minimum date for booking input to today
  const bookingDateInput = document.getElementById('bookingDate');
  if (bookingDateInput) {
    const today = new Date().toISOString().split('T')[0];
    bookingDateInput.min = today;
    bookingDateInput.value = today;
  }
});

// Load from LocalStorage
function loadStoredData() {
  try {
    const storedAppts = localStorage.getItem(STORAGE_KEYS.APPOINTMENTS);
    if (storedAppts) {
      appointments = JSON.parse(storedAppts);
    }

    const storedRx = localStorage.getItem(STORAGE_KEYS.PRESCRIPTIONS);
    if (storedRx) {
      prescriptions = JSON.parse(storedRx);
    } else {
      // Preload standard sample prescriptions for initial view
      prescriptions = [
        {
          id: 'rx-1',
          name: 'Paracetamol 500mg',
          dosage: '2 tablets',
          frequency: 'Three Times Daily (8-hour interval)',
          instructions: 'Take after meals for fever or aches',
          takenToday: false,
          createdDate: new Date().toLocaleDateString()
        },
        {
          id: 'rx-2',
          name: 'Amoxicillin 250mg',
          dosage: '1 capsule',
          frequency: 'Twice Daily (Morning, Night)',
          instructions: 'Finish full 5-day antibiotic course',
          takenToday: true,
          createdDate: new Date().toLocaleDateString()
        }
      ];
      savePrescriptions();
    }
  } catch (e) {
    console.error('Error loading LocalStorage', e);
  }
}

function saveAppointments() {
  localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
  updateAppointmentBadge();
}

function savePrescriptions() {
  localStorage.setItem(STORAGE_KEYS.PRESCRIPTIONS, JSON.stringify(prescriptions));
  renderPrescriptions();
}

function updateAppointmentBadge() {
  const badge = document.getElementById('apptCountBadge');
  if (badge) {
    badge.textContent = appointments.length;
  }
}

// Render Doctors Cards
function renderDoctors(docs) {
  const container = document.getElementById('doctorsGrid');
  if (!container) return;

  if (docs.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem; color: #64748b;">
        <p style="font-size: 1.25rem; font-weight: 600;">No doctors match your filter criteria.</p>
        <p>Try clearing search keywords or selecting "All Specialties".</p>
      </div>
    `;
    return;
  }

  container.innerHTML = docs.map(doc => `
    <article class="doctor-card">
      <div class="card-top">
        <div class="doc-avatar">${doc.avatar}</div>
        <div class="doc-meta">
          <h4>${doc.name}</h4>
          <span class="specialty-label">${doc.specialty}</span>
          <p class="doc-sub">🏥 ${doc.hospital}</p>
        </div>
      </div>

      <div class="availability-tag">
        <span class="live-dot" style="background-color: ${doc.isOnline ? '#22c55e' : '#94a3b8'}"></span>
        ${doc.isOnline ? 'Available Online Now' : (doc.availableToday ? 'Available Later Today' : 'Next Available Tomorrow')}
      </div>

      <div class="card-details">
        <div>
          <span style="color: #64748b; font-size: 0.75rem;">Experience</span>
          <strong>${doc.experience}</strong>
        </div>
        <div>
          <span style="color: #64748b; font-size: 0.75rem;">Rating</span>
          <strong style="color: #d97706;">★ ${doc.rating} (${doc.reviews})</strong>
        </div>
        <div>
          <span style="color: #64748b; font-size: 0.75rem;">Consult Fee</span>
          <span class="fee-val">${doc.fee}</span>
        </div>
      </div>

      <button class="btn btn-primary btn-block" onclick="openBookingModal('${doc.name}', '${doc.specialty}', '${doc.fee}')">
        Book Consultation
      </button>
    </article>
  `).join('');
}

// Filter Function
function applyFilters() {
  const query = document.getElementById('doctorSearchInput').value.toLowerCase().trim();
  const specialty = document.getElementById('specialtyFilter').value;
  const availability = document.getElementById('availabilityFilter').value;

  const filtered = DOCTORS_DATA.filter(doc => {
    const matchesSearch = !query || 
      doc.name.toLowerCase().includes(query) || 
      doc.specialty.toLowerCase().includes(query) || 
      doc.hospital.toLowerCase().includes(query) ||
      doc.languages.toLowerCase().includes(query);

    const matchesSpecialty = specialty === 'all' || doc.specialty === specialty;

    let matchesAvail = true;
    if (availability === 'online') {
      matchesAvail = doc.isOnline;
    } else if (availability === 'today') {
      matchesAvail = doc.availableToday || doc.isOnline;
    }

    return matchesSearch && matchesSpecialty && matchesAvail;
  });

  renderDoctors(filtered);
}

// Modal logic for booking
function openBookingModal(docName, specialty, fee) {
  const modal = document.getElementById('bookingModal');
  const title = document.getElementById('modalDoctorTitle');
  const docSummary = document.getElementById('doctorSummaryBox');
  const hiddenName = document.getElementById('bookDoctorName');
  const hiddenFee = document.getElementById('bookDoctorFee');

  title.textContent = `Book with ${docName}`;
  hiddenName.value = docName;
  hiddenFee.value = fee;
  docSummary.innerHTML = `
    <strong>Specialty:</strong> ${specialty}<br>
    <strong>Consultation Fee:</strong> ${fee}<br>
    <small style="color: #64748b;">Direct confirmation sent via SMS/WhatsApp</small>
  `;

  modal.classList.add('open');
}

function closeBookingModal() {
  const modal = document.getElementById('bookingModal');
  modal.classList.remove('open');
}

// Appointments List Modal
function openAppointmentsModal() {
  const modal = document.getElementById('appointmentsModal');
  const content = document.getElementById('appointmentsListContent');

  if (appointments.length === 0) {
    content.innerHTML = `
      <div style="text-align: center; padding: 2rem 1rem; color: #64748b;">
        <p style="font-size: 2rem; margin-bottom: 0.5rem;">📅</p>
        <p style="font-weight: 600;">No appointments booked yet.</p>
        <p style="font-size: 0.85rem;">Find a specialist above to book your first clinic or virtual visit.</p>
      </div>
    `;
  } else {
    content.innerHTML = appointments.map((appt, idx) => `
      <div class="appt-item">
        <div class="appt-header-row">
          <div>
            <strong>${appt.doctorName}</strong>
            <p style="font-size: 0.8rem; color: #64748b;">Patient: ${appt.patientName}</p>
          </div>
          <span class="appt-badge">${appt.mode}</span>
        </div>
        <p style="font-size: 0.85rem; margin: 0.4rem 0;">
          🕒 <strong>${appt.date}</strong> at <strong>${appt.time}</strong>
        </p>
        ${appt.notes ? `<p style="font-size: 0.8rem; color: #475569; background: #e2e8f0; padding: 0.35rem 0.5rem; border-radius: 4px;">Reason: ${appt.notes}</p>` : ''}
        <button class="cancel-appt-btn" onclick="cancelAppointment(${idx})">Cancel Booking</button>
      </div>
    `).join('');
  }

  modal.classList.add('open');
}

function cancelAppointment(index) {
  if (confirm("Are you sure you want to cancel this appointment?")) {
    appointments.splice(index, 1);
    saveAppointments();
    openAppointmentsModal();
    showToast("Appointment successfully cancelled.");
  }
}

// Prescription Tracker Logic
function renderPrescriptions() {
  const list = document.getElementById('rxItemsList');
  const count = document.getElementById('rxCount');
  if (!list) return;

  count.textContent = prescriptions.length;

  if (prescriptions.length === 0) {
    list.innerHTML = `
      <div style="text-align: center; padding: 2.5rem 1rem; color: #64748b;">
        <p>No medications in your schedule.</p>
        <p style="font-size: 0.85rem;">Add a new medicine on the left to track doses.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = prescriptions.map((item) => `
    <div class="rx-item ${item.takenToday ? 'taken' : ''}">
      <div class="rx-info">
        <h4>${item.name}</h4>
        <div class="rx-details">
          <span><strong>Dose:</strong> ${item.dosage}</span> • 
          <span><strong>Schedule:</strong> ${item.frequency}</span>
        </div>
        ${item.instructions ? `<p style="font-size: 0.8rem; color: #0284c7; margin-top: 0.2rem;">ℹ️ ${item.instructions}</p>` : ''}
      </div>
      <div class="rx-actions">
        <button class="btn-rx-check ${item.takenToday ? 'checked' : ''}" onclick="toggleRxTaken('${item.id}')">
          ${item.takenToday ? '✓ Dose Taken' : 'Mark Dose Taken'}
        </button>
        <button class="btn-rx-delete" title="Delete" onclick="deleteRx('${item.id}')">✕</button>
      </div>
    </div>
  `).join('');
}

function toggleRxTaken(id) {
  const item = prescriptions.find(p => p.id === id);
  if (item) {
    item.takenToday = !item.takenToday;
    savePrescriptions();
    showToast(item.takenToday ? `Marked ${item.name} as taken today!` : `Dose status reset.`);
  }
}

function deleteRx(id) {
  prescriptions = prescriptions.filter(p => p.id !== id);
  savePrescriptions();
  showToast("Medication removed from reminder.");
}

// Chat Consultation System
function handleChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  addChatMessage(text, 'outgoing');
  input.value = '';

  // Simulate clinical triage response
  setTimeout(() => {
    generateDoctorResponse(text);
  }, 900);
}

function addChatMessage(text, direction) {
  const container = document.getElementById('chatMessages');
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${direction}`;
  msgDiv.innerHTML = `
    <p>${escapeHtml(text)}</p>
    <span class="msg-time">${now}</span>
  `;

  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

function sendQuickPrompt(promptText) {
  const input = document.getElementById('chatInput');
  input.value = promptText;
  document.getElementById('chatForm').dispatchEvent(new Event('submit'));
}

function generateDoctorResponse(userText) {
  const lower = userText.toLowerCase();
  let reply = "Thank you for explaining your symptoms. I am recording these notes in your digital triage chart.";

  if (lower.includes('fever') || lower.includes('temperature') || lower.includes('hot')) {
    reply = "For high fever, stay well hydrated and consider paracetamol for comfort. If your temperature stays above 38.5°C (101.3°F) for over 48 hours or you develop stiff neck or breathing difficulty, immediate clinic evaluation is recommended.";
  } else if (lower.includes('cough') || lower.includes('chest') || lower.includes('breath')) {
    reply = "A persistent cough should be monitored for sputum color, shortness of breath, or chest pain. Please avoid unprescribed antibiotics; drink warm fluids and honey/lemon. Would you like to schedule an audio consult?";
  } else if (lower.includes('stomach') || lower.includes('vomit') || lower.includes('diarrhea') || lower.includes('nausea')) {
    reply = "For gastrointestinal discomfort, the primary priority is electrolyte replacement (such as Oral Rehydration Salts / ORS in boiled water). Avoid dairy, greasy foods, and seek urgent care if you observe severe dehydration or blood in stool.";
  } else if (lower.includes('rash') || lower.includes('skin') || lower.includes('itch')) {
    reply = "Skin reactions may stem from contact allergens, insect bites, or viral causes. Avoid scratching to prevent secondary bacterial infection. Keep the area clean and apply cool calamine or bland moisturizer.";
  } else {
    reply = "Understood. Based on your description, this could benefit from direct assessment with one of our online General Practitioners or specialists. You can use the 'Book Consultation' option to lock in a time slot!";
  }

  addChatMessage(reply, 'incoming');
}

// Call Simulator Modal
function startAudioCallSimulation() {
  const modal = document.getElementById('callModal');
  const timer = document.getElementById('callTimer');
  modal.classList.add('open');

  let seconds = 0;
  timer.textContent = "Connecting low-data audio stream...";

  setTimeout(() => {
    timer.textContent = "Call connected (00:01) • HD Audio (2.4 kbps)";
    clearInterval(callIntervalTimer);
    callIntervalTimer = setInterval(() => {
      seconds++;
      const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
      const secs = String(seconds % 60).padStart(2, '0');
      timer.textContent = `Call in progress (${mins}:${secs}) • Secure MedLink Voice`;
    }, 1000);
  }, 1800);
}

function endAudioCallSimulation() {
  clearInterval(callIntervalTimer);
  const modal = document.getElementById('callModal');
  modal.classList.remove('open');
  showToast("Consultation call ended.");
}

// Toast notification helper
function showToast(message) {
  const toast = document.getElementById('toastNotification');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}

function escapeHtml(string) {
  const entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return String(string).replace(/[&<>"']/g, s => entityMap[s]);
}

// Setup Event Listeners
function setupEventListeners() {
  // Mobile nav toggle
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');
  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
    });

    // Close menu when link clicked
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => navLinks.classList.remove('active'));
    });
  }

  // Doctor filters
  const searchInput = document.getElementById('doctorSearchInput');
  const specialtyFilter = document.getElementById('specialtyFilter');
  const availFilter = document.getElementById('availabilityFilter');

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (specialtyFilter) specialtyFilter.addEventListener('change', applyFilters);
  if (availFilter) availFilter.addEventListener('change', applyFilters);

  // Booking Modal
  const closeBookingBtn = document.getElementById('closeBookingModal');
  const cancelBookingBtn = document.getElementById('cancelBookingBtn');
  const bookingModal = document.getElementById('bookingModal');
  const bookingForm = document.getElementById('bookingForm');

  if (closeBookingBtn) closeBookingBtn.addEventListener('click', closeBookingModal);
  if (cancelBookingBtn) cancelBookingBtn.addEventListener('click', closeBookingModal);

  if (bookingForm) {
    bookingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const newAppt = {
        doctorName: document.getElementById('bookDoctorName').value,
        fee: document.getElementById('bookDoctorFee').value,
        patientName: document.getElementById('patientName').value,
        patientPhone: document.getElementById('patientPhone').value,
        mode: document.getElementById('consultationMode').value,
        date: document.getElementById('bookingDate').value,
        time: document.getElementById('bookingTime').value,
        notes: document.getElementById('bookingNotes').value
      };

      appointments.push(newAppt);
      saveAppointments();
      closeBookingModal();
      bookingForm.reset();
      showToast(`Appointment confirmed with ${newAppt.doctorName} on ${newAppt.date}!`);
    });
  }

  // Appointments Drawer
  const myApptsBtn = document.getElementById('myAppointmentsBtn');
  const closeApptsModal = document.getElementById('closeApptsModal');
  const closeApptsBtn = document.getElementById('closeApptsBtn');
  const apptsModal = document.getElementById('appointmentsModal');

  if (myApptsBtn) myApptsBtn.addEventListener('click', openAppointmentsModal);
  if (closeApptsModal) closeApptsModal.addEventListener('click', () => apptsModal.classList.remove('open'));
  if (closeApptsBtn) closeApptsBtn.addEventListener('click', () => apptsModal.classList.remove('open'));

  // Chat Form
  const chatForm = document.getElementById('chatForm');
  if (chatForm) chatForm.addEventListener('submit', handleChatSubmit);

  // Audio Call Buttons
  const startCallBtn = document.getElementById('startVoiceCallBtn');
  const endCallBtn = document.getElementById('endCallBtn');
  const muteCallBtn = document.getElementById('muteCallBtn');

  if (startCallBtn) startCallBtn.addEventListener('click', startAudioCallSimulation);
  if (endCallBtn) endCallBtn.addEventListener('click', endAudioCallSimulation);
  if (muteCallBtn) {
    let muted = false;
    muteCallBtn.addEventListener('click', () => {
      muted = !muted;
      muteCallBtn.style.backgroundColor = muted ? '#fca5a5' : '#f1f5f9';
      showToast(muted ? "Microphone muted" : "Microphone active");
    });
  }

  // Prescription Form
  const addRxForm = document.getElementById('addRxForm');
  if (addRxForm) {
    addRxForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('rxMedicineName').value.trim();
      const dosage = document.getElementById('rxDosage').value.trim();
      const frequency = document.getElementById('rxFrequency').value;
      const instructions = document.getElementById('rxInstructions').value.trim();

      const newMed = {
        id: 'rx-' + Date.now(),
        name,
        dosage,
        frequency,
        instructions,
        takenToday: false,
        createdDate: new Date().toLocaleDateString()
      };

      prescriptions.unshift(newMed);
      savePrescriptions();
      addRxForm.reset();
      showToast(`Medication ${name} saved to reminders.`);
    });
  }

  const seedDemoRxBtn = document.getElementById('seedDemoRxBtn');
  if (seedDemoRxBtn) {
    seedDemoRxBtn.addEventListener('click', () => {
      prescriptions = [
        {
          id: 'rx-' + Date.now(),
          name: 'Metformin 500mg',
          dosage: '1 tablet',
          frequency: 'Twice Daily (Morning, Night)',
          instructions: 'Take immediately with meals to avoid stomach upset',
          takenToday: false,
          createdDate: new Date().toLocaleDateString()
        },
        {
          id: 'rx-' + (Date.now() + 1),
          name: 'Artemether-Lumefantrine (Coartem)',
          dosage: '4 tablets',
          frequency: 'Twice Daily (Morning, Night)',
          instructions: 'Take full anti-malarial course with fatty food or milk',
          takenToday: true,
          createdDate: new Date().toLocaleDateString()
        },
        {
          id: 'rx-' + (Date.now() + 2),
          name: 'Multivitamin & Zinc',
          dosage: '1 capsule',
          frequency: 'Once Daily (Morning)',
          instructions: 'Daily immune maintenance',
          takenToday: false,
          createdDate: new Date().toLocaleDateString()
        }
      ];
      savePrescriptions();
      showToast("Demo prescription schedule loaded!");
    });
  }

  // First Aid Accordion
  const accordionTriggers = document.querySelectorAll('.accordion-trigger');
  accordionTriggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
      const parent = trigger.parentElement;
      const isActive = parent.classList.contains('active');
      document.querySelectorAll('.accordion-item').forEach(item => item.classList.remove('active'));
      if (!isActive) {
        parent.classList.add('active');
      }
    });
  });

  // Close modals on background backdrop click
  window.addEventListener('click', (e) => {
    if (e.target === bookingModal) closeBookingModal();
    if (e.target === apptsModal) apptsModal.classList.remove('open');
  });
}
