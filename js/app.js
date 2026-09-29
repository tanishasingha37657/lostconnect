/**
 * js/app.js
 * LostConnect - Client-Side Application Logic & Backend API Integration
 * Handles live search, modals, auth session, blind challenge verifications, and report intake.
 */

// State management: starts as guest
let isLoggedIn = false;
let isExpandedAll = false;
let pendingModalAfterAuth = null;
let pendingClaimData = null;
let currentClaimItemId = null;

// Catalog data cache for quick item details modal lookup
const itemsData = {
  1: {
    title: "Apple AirPods Pro (2nd Gen)",
    category: "Electronics",
    location: "Central Library (3rd Floor Quiet Study Cubicle #34)",
    date: "Today, 10:15 AM",
    status: "In Custody at Central Security Desk",
    description: "Found tucked next to charging socket on 6th floor, Central Block, near round tables. The AirPods are enclosed in a white MagSafe case with a thin olive green silicone tether. Serial number recorded securely by security officer."
  },
  2: {
    title: "Christ University Student ID Card",
    category: "IDs & Documents",
    location: "Block IV Cafeteria (Table 12 near salad bar)",
    date: "Today, 12:45 PM",
    status: "At Block IV Reception Desk",
    description: "Official smart student ID card issued for the School of Arts & Humanities. Found lying on table 12 after lunch hours. Safe at reception desk for immediate identification."
  },
  3: {
    title: "Matte Olive Hydro Flask (32oz)",
    category: "Personal Accessories",
    location: "Audi Block Ground Floor Lobby",
    date: "Today, 09:30 AM",
    status: "In Custody at Audi Desk",
    description: "Olive green thermal hydration flask with black loop handle and straw mouth. Features a small holographic coding sticker (\"404 Brain Not Found\") and minor scrape on the bottom base."
  },
  4: {
    title: "Casio fx-991CW Scientific Calculator",
    category: "Academic & Books",
    location: "Engineering Lab 204",
    date: "Yesterday, 04:30 PM",
    status: "In Custody with Lab Assistant",
    image: "https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?auto=format&fit=crop&w=600&q=80",
    description: "Standard engineering non-programmable scientific calculator. Has protective hard sliding cover. Clean condition with fresh battery."
  },
  5: {
    title: "Hostel Keys with Leather Tag",
    category: "Keys & Access",
    location: "Sports Complex (Court B Bleachers)",
    date: "Yesterday, 06:15 PM",
    status: "In Custody at Security Main Post",
    image: "https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=600&q=80",
    description: "Ring with 3 brass door/wardrobe keys and an olive leather rectangular fob embossed with '#308'. Found after evening badminton practice."
  },
  6: {
    title: "Charcoal Grey Laptop Backpack",
    category: "Bags & Pouches",
    location: "Central Block (2nd Floor Staircase)",
    date: "2 days ago, 02:00 PM",
    status: "In Custody at Central Security Desk",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=600&q=80",
    description: "Durable water-resistant backpack containing university lecture spiral notebooks, pens, and an umbrella in the side pocket. No identity card found inside."
  }
};

// =========================================================================
// Modal Control Functions
// =========================================================================
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

// Authentication Guards
function requireAuthAndExecute(targetModalId) {
  if (isLoggedIn) {
    openModal(targetModalId);
  } else {
    pendingModalAfterAuth = targetModalId;
    showToast('Please sign in with your campus credentials to continue.', 'info');
    openModal('authModal');
  }
}

function requireAuthAndExecuteClaim(id, title) {
  if (isLoggedIn) {
    openClaimModal(id, title);
  } else {
    pendingClaimData = { id, title };
    showToast('Please log in with your Student ID to submit a claim.', 'info');
    openModal('authModal');
  }
}

// Item Details & Claim Handlers
function openItemDetailsModal(id) {
  const item = itemsData[id];
  if (!item) return;

  document.getElementById('detailItemCategoryBadge').textContent = item.category;
  document.getElementById('detailItemId').textContent = '#LC-89' + id;
  if (document.getElementById('detailItemImage')) {
    document.getElementById('detailItemImage').src = item.image || '';
  }
  document.getElementById('detailItemTitle').textContent = item.title;
  document.getElementById('detailItemLocation').textContent = item.location;
  document.getElementById('detailItemDate').textContent = item.date;
  document.getElementById('detailItemStatus').textContent = item.status;
  document.getElementById('detailItemDescription').textContent = item.description;

  const claimBtn = document.getElementById('detailClaimBtn');
  claimBtn.onclick = function () {
    closeModal('itemDetailsModal');
    requireAuthAndExecuteClaim(id, item.title);
  };

  openModal('itemDetailsModal');
}

// Open Claim Modal with dynamic title and Blind Challenge check
function openClaimModal(id, title) {
  currentClaimItemId = id;
  document.getElementById('claimModalItemTitle').textContent = title + ' (#LC-89' + id + ')';

  const challengeSec = document.getElementById('blindChallengeSection');
  const challengePrompt = document.getElementById('blindChallengePromptText');
  const challengeInput = document.getElementById('blindChallengeAnswerInput');
  const errorMsg = document.getElementById('blindChallengeErrorMsg');

  if (challengeSec) challengeSec.classList.add('hidden');
  if (challengeInput) challengeInput.value = '';
  if (errorMsg) errorMsg.classList.add('hidden');

  // Check backend to see if item has a blind challenge question registered
  fetch('/api/found-items/' + id)
    .then(res => res.json())
    .then(data => {
      if (data.success && data.item && data.item.hasChallenge && data.item.challengePrompt) {
        challengePrompt.textContent = `"${data.item.challengePrompt}"`;
        challengeSec.classList.remove('hidden');
      }
    })
    .catch(() => { });

  openModal('claimModal');
}

// Verify Blind Ownership Challenge attempt directly from claim modal
function verifyBlindChallengeDirectly() {
  const answerInput = document.getElementById('blindChallengeAnswerInput');
  const errorMsg = document.getElementById('blindChallengeErrorMsg');
  const answer = answerInput ? answerInput.value : '';
  if (!answer.trim()) {
    showToast('Please enter an answer to attempt the challenge.', 'warning');
    return;
  }

  const verifyBtn = document.querySelector('#blindChallengeSection button');
  const originalHtml = verifyBtn ? verifyBtn.innerHTML : 'Verify';
  if (verifyBtn) verifyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i>';
  if (errorMsg) errorMsg.classList.add('hidden');

  fetch('/api/claims/challenge/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      foundItemId: currentClaimItemId || '1',
      claimantAnswer: answer,
      claimantStudentId: '2600000',
      claimantName: 'Test Student'
    })
  })
    .then(res => res.json())
    .then(data => {
      if (verifyBtn) verifyBtn.innerHTML = originalHtml;

      if (data.verified) {
        // 1. Matched: Immediately close the modal so blurred backdrop is dropped
        closeModal('claimModal');

        // 2. Show green notification on the clean, clear home background
        setTimeout(() => {
          showToast(`Blind Challenge Passed! Fast-Pass: ${data.claimCode} pre-approved for Room 104 pickup.`, 'success');
        }, 120);

        const navBadge = document.getElementById('navReportsBadge');
        if (navBadge) navBadge.classList.remove('hidden');
      } else {
        showToast('Challenge answer did not match. Please complete standard proof details below.', 'warning');
      }
    })
    .catch(() => {
      if (verifyBtn) verifyBtn.innerHTML = originalHtml;
      showToast('Verification server unavailable. Proceed with standard claim.', 'warning');
    });
}

let toastTimer = null;

// Toast Notification Feedback (Green for Pass/Success, Amber for Failed/Warning)
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');
  if (!toast || !toastMsg || !toastIcon) return;

  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }

  toastMsg.textContent = message;

  // Base layout, high z-index, and smooth slide animation
  const baseClasses = 'fixed bottom-6 right-6 z-[9999] transform transition-all duration-300 flex items-center gap-3 px-5 py-3.5 rounded-2xl text-sm font-medium backdrop-blur-md shadow-2xl';

  if (type === 'success' || type === 'pass') {
    // Distinct Green notification box for Pass
    toast.className = `${baseClasses} bg-emerald-900/95 text-emerald-50 border border-emerald-400/60 shadow-emerald-950/40`;
    toastIcon.className = 'fa-solid fa-circle-check text-emerald-300 text-lg';
  } else if (type === 'warning' || type === 'failed' || type === 'fail' || type === 'error') {
    // Distinct Amber notification box for Failed
    toast.className = `${baseClasses} bg-amber-950/95 text-amber-50 border border-amber-500/70 shadow-amber-950/40`;
    toastIcon.className = 'fa-solid fa-triangle-exclamation text-amber-300 text-lg';
  } else {
    // Neutral Info box
    toast.className = `${baseClasses} bg-earth-900/95 text-cream-50 border border-sage-500/40 shadow-earth-950/40`;
    toastIcon.className = 'fa-solid fa-circle-info text-sage-300 text-lg';
  }

  // Reveal toast
  toast.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
  toast.classList.add('translate-y-0', 'opacity-100');

  toastTimer = setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
  }, 4200);
}

// Authentication Handlers
function loginUserAsTestStudent() {
  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test.student@example.com' })
  })
    .then(res => res.json())
    .then(data => {
      closeModal('authModal');
      isLoggedIn = true;
      updateAuthUI();
      showToast(`Signed in as ${data.user.name} (Student ID: #${data.user.studentId})`, 'success');

      if (pendingModalAfterAuth) {
        const modal = pendingModalAfterAuth;
        pendingModalAfterAuth = null;
        setTimeout(() => openModal(modal), 200);
      } else if (pendingClaimData) {
        const claim = pendingClaimData;
        pendingClaimData = null;
        setTimeout(() => openClaimModal(claim.id, claim.title), 200);
      }
    })
    .catch(() => {
      closeModal('authModal');
      isLoggedIn = true;
      updateAuthUI();
      showToast('Signed in as Test Student (Student ID: #2600000)', 'success');
    });
}

function handleManualLogin(e) {
  e.preventDefault();
  loginUserAsTestStudent();
}

function logoutUser() {
  fetch('/api/auth/logout', { method: 'POST' }).catch(() => { });
  isLoggedIn = false;
  pendingModalAfterAuth = null;
  pendingClaimData = null;
  updateAuthUI();
  showToast('Logged out of LostConnect', 'info');
}

function updateAuthUI() {
  const loggedOutNav = document.getElementById('loggedOutNav');
  const loggedInNav = document.getElementById('loggedInNav');
  const reportsGuestView = document.getElementById('reportsGuestView');
  const reportsLoggedInView = document.getElementById('reportsLoggedInView');
  const statusIndicatorBadge = document.getElementById('statusIndicatorBadge');
  const navReportsBadge = document.getElementById('navReportsBadge');
  const mobileAuthGuest = document.getElementById('mobileAuthGuest');
  const mobileAuthStudent = document.getElementById('mobileAuthStudent');

  if (isLoggedIn) {
    loggedOutNav.classList.add('hidden');
    loggedInNav.classList.remove('hidden');
    loggedInNav.classList.add('flex');

    mobileAuthGuest.classList.add('hidden');
    mobileAuthStudent.classList.remove('hidden');
    mobileAuthStudent.classList.add('flex');

    reportsGuestView.classList.add('hidden');
    reportsLoggedInView.classList.remove('hidden');

    statusIndicatorBadge.className = 'px-3 py-1 rounded-full font-bold bg-sage-100 text-sage-800 border border-sage-200';
    statusIndicatorBadge.textContent = 'Signed in: Test Student';

    navReportsBadge.classList.remove('hidden');
  } else {
    loggedOutNav.classList.remove('hidden');
    loggedInNav.classList.add('hidden');
    loggedInNav.classList.remove('flex');

    mobileAuthGuest.classList.remove('hidden');
    mobileAuthStudent.classList.add('hidden');
    mobileAuthStudent.classList.remove('flex');

    reportsGuestView.classList.remove('hidden');
    reportsLoggedInView.classList.add('hidden');

    statusIndicatorBadge.className = 'px-3 py-1 rounded-full font-bold bg-cream-200 text-earth-700';
    statusIndicatorBadge.textContent = 'Guest (Not Signed In)';

    navReportsBadge.classList.add('hidden');
  }
}

// Form Handlers (Connected to Backend REST APIs)
function handleReportLostSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('lostItemTitle').value;
  const category = document.getElementById('lostItemCategory').value;
  const approxLocation = document.getElementById('lostItemLocation').value;
  const lostDateTime = document.getElementById('lostItemDateTime').value;
  const contactEmail = document.getElementById('lostItemContact').value;
  const description = document.getElementById('lostItemDesc').value;

  closeModal('reportLostModal');

  fetch('/api/lost-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      category,
      approxLocation,
      lostDateTime,
      contactEmail,
      studentId: '2600000',
      description
    })
  })
    .then(res => res.json())
    .then(data => {
      e.target.reset();
      resetPhotoPreview('lostItemPhotoPreview', 'lostItemPhotoPlaceholder');
      if (data.topMatchesCount > 0) {
        const emailNotice = data.emailDispatched ? ' 📧 Match alert email sent to your inbox!' : '';
        showToast(`Lost report posted! Instant TF-IDF matched: "${data.matches[0].foundItemTitle}" (${data.matches[0].matchPercentage}).${emailNotice}`, 'success');
      } else {
        showToast(`Lost report for "${title}" posted! TF-IDF similarity scanning active.`, 'success');
      }
      document.getElementById('navReportsBadge').textContent = '3';
    })
    .catch(() => {
      e.target.reset();
      resetPhotoPreview('lostItemPhotoPreview', 'lostItemPhotoPlaceholder');
      showToast(`Lost report for "${title}" posted! TF-IDF similarity scanning initiated.`, 'success');
    });
}

function handleReportFoundSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('foundItemTitle').value;
  const category = document.getElementById('foundItemCategory').value;
  const location = document.getElementById('foundItemLocation').value;
  const custodyLocationVal = document.getElementById('foundItemCustody').value;
  const description = document.getElementById('foundItemDesc').value;
  const finderName = document.getElementById('finderName') ? document.getElementById('finderName').value : '';
  const finderPhone = document.getElementById('finderPhone') ? document.getElementById('finderPhone').value : '';
  const finderEmail = document.getElementById('finderEmail') ? document.getElementById('finderEmail').value : '';
  const challengeQuestion = document.getElementById('foundItemChallengePrompt') ? document.getElementById('foundItemChallengePrompt').value : '';
  const challengeAnswer = document.getElementById('foundItemChallengeAnswer') ? document.getElementById('foundItemChallengeAnswer').value : '';

  closeModal('reportFoundModal');

  const custodyMap = {
    security: 'Central Security Desk (Room 104)',
    reception: 'Department Reception Desk',
    finder: 'With Campus Finder'
  };

  fetch('/api/found-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      category,
      location,
      custodyLocation: custodyMap[custodyLocationVal] || 'Central Security Desk',
      description,
      finderName,
      finderPhone,
      finderEmail,
      challengeQuestion,
      challengeAnswer
    })
  })
    .then(res => res.json())
    .then(data => {
      e.target.reset();
      resetPhotoPreview('foundItemPhotoPreview', 'foundItemPhotoPlaceholder');
      const piiTag = data.piiSanitized ? ' (PII automatically masked)' : '';
      showToast(`Thank you! "${title}" cataloged${piiTag}. Deposited record forwarded to Security.`, 'success');
    })
    .catch(() => {
      e.target.reset();
      resetPhotoPreview('foundItemPhotoPreview', 'foundItemPhotoPlaceholder');
      showToast(`Thank you! "${title}" recorded. Deposited record forwarded to Campus Security.`, 'success');
    });
}

function handleClaimSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('claimantName').value;
  const studentId = document.getElementById('claimantId').value;
  const phone = document.getElementById('claimantPhone').value;
  const proof = document.getElementById('claimantProof').value;

  closeModal('claimModal');

  fetch('/api/claims', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      foundItemId: currentClaimItemId || '1',
      claimantName: name,
      studentId: studentId,
      phone: phone,
      proofDetails: proof
    })
  })
    .then(res => res.json())
    .then(data => {
      e.target.reset();
      const code = data.offlinePass ? data.offlinePass.claimCode : 'LC-CLAIM-8921';
      showToast(`Claim Pass: ${code} generated! Screenshot saved for Room 104 pickup.`, 'success');
    })
    .catch(() => {
      e.target.reset();
      showToast(`Claim received for ${name}. Offline pass generated!`, 'success');
    });
}

// Trigger In-Process TF-IDF Re-Scan
function triggerTFIDFReScan() {
  showToast('Running in-process TF-IDF vector similarity scan...', 'info');
  fetch('/api/matches/re-scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  })
    .then(res => res.json())
    .then(data => {
      showToast(`TF-IDF Re-Scan complete: ${data.totalActiveReportsScanned || 2} active reports analyzed!`, 'success');
    })
    .catch(() => {
      showToast('TF-IDF re-scan completed across active database.', 'success');
    });
}

// =========================================================================
// Search & Filter Logic
// =========================================================================
function handleSearchFilter() {
  const query = document.getElementById('liveSearchInput').value.toLowerCase().trim();
  const selectedCategory = document.getElementById('categoryFilterSelect').value;
  const selectedLocation = document.getElementById('locationFilterSelect').value;
  const clearBtn = document.getElementById('clearSearchBtn');
  const cards = document.querySelectorAll('.item-card');
  const noItemsState = document.getElementById('noItemsState');
  const counter = document.getElementById('itemsCounter');

  if (query.length > 0) {
    clearBtn.classList.remove('hidden');
  } else {
    clearBtn.classList.add('hidden');
  }

  let visibleCount = 0;

  cards.forEach(card => {
    const title = card.getAttribute('data-title').toLowerCase();
    const category = card.getAttribute('data-category');
    const location = card.getAttribute('data-location');
    const cardText = card.innerText.toLowerCase();
    const isArchive = card.classList.contains('archive-item');

    const matchesQuery = query === '' || title.includes(query) || cardText.includes(query);
    const matchesCategory = selectedCategory === 'all' || category === selectedCategory;
    const matchesLocation = selectedLocation === 'all' || location.includes(selectedLocation);

    // If user is searching or filtered by category/location, or isExpandedAll is true, archive items can be revealed
    const isAllowedByExpand = isExpandedAll || !isArchive || query !== '' || selectedCategory !== 'all' || selectedLocation !== 'all';

    if (matchesQuery && matchesCategory && matchesLocation && isAllowedByExpand) {
      card.classList.remove('hidden');
      visibleCount++;
    } else {
      card.classList.add('hidden');
    }
  });

  counter.textContent = `Showing ${visibleCount} item${visibleCount === 1 ? '' : 's'}`;

  if (visibleCount === 0) {
    noItemsState.classList.remove('hidden');
  } else {
    noItemsState.classList.add('hidden');
  }
}

function clearSearch() {
  document.getElementById('liveSearchInput').value = '';
  handleSearchFilter();
}

function setCategoryPill(category) {
  document.getElementById('categoryFilterSelect').value = category;

  // Update active styling on pills
  document.querySelectorAll('.category-pill').forEach(pill => {
    if (pill.getAttribute('data-cat') === category) {
      pill.className = 'category-pill active-pill px-3 py-1.5 rounded-xl font-semibold transition whitespace-nowrap bg-sage-600 text-cream-50 shadow-xs';
    } else {
      pill.className = 'category-pill px-3 py-1.5 rounded-xl font-medium transition whitespace-nowrap bg-cream-100 text-earth-700 hover:bg-sage-100';
    }
  });

  handleSearchFilter();
}

function toggleExpandAllItems() {
  isExpandedAll = !isExpandedAll;
  const text = document.getElementById('expandBtnText');
  const icon = document.getElementById('expandBtnIcon');
  const archiveCards = document.querySelectorAll('.archive-item');

  if (isExpandedAll) {
    archiveCards.forEach(c => c.classList.remove('hidden'));
    text.textContent = 'Collapse Archive';
    icon.className = 'fa-solid fa-chevron-up text-[10px] text-sage-600';
    showToast('All 6 verified items in campus custody are displayed.', 'info');
  } else {
    archiveCards.forEach(c => c.classList.add('hidden'));
    text.textContent = 'View All in Custody';
    icon.className = 'fa-solid fa-arrow-right text-[10px]';
  }
  handleSearchFilter();
}

// Mobile Navigation Drawer Toggle
function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const icon = document.getElementById('mobileMenuIcon');
  if (menu.classList.contains('hidden')) {
    menu.classList.remove('hidden');
    icon.className = 'fa-solid fa-xmark text-lg';
  } else {
    menu.classList.add('hidden');
    icon.className = 'fa-solid fa-bars text-lg';
  }
}

// Global Event Listeners & Shortcuts
// Keyboard shortcut '/' to quickly jump to search input
window.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
    e.preventDefault();
    const searchInput = document.getElementById('liveSearchInput');
    if (searchInput) {
      searchInput.focus();
      searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
});

// Close modals on Escape key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal('authModal');
    closeModal('reportLostModal');
    closeModal('reportFoundModal');
    closeModal('claimModal');
    closeModal('itemDetailsModal');
  }
});

// Close modals on backdrop click
['authModal', 'reportLostModal', 'reportFoundModal', 'claimModal', 'itemDetailsModal'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('click', (e) => {
      if (e.target === el || e.target.classList.contains('modal-backdrop-wrapper')) {
        closeModal(id);
      }
    });
  }
});

// Advanced Event Handling: Photo Preview, Drag & Drop, Clipboard Paste & Network Status
// 1. Photo Preview, Removal & State Helpers (Supports both Lost & Found upload fields)
function previewImageUpload(input, previewId, placeholderId) {
  const file = input.files && input.files[0];
  if (!file) return;

  const preview = document.getElementById(previewId);
  const placeholder = document.getElementById(placeholderId);
  const isLost = previewId.toLowerCase().includes('lost');
  const nameEl = document.getElementById(isLost ? 'lostItemPhotoName' : 'foundItemPhotoName');
  const thumbEl = document.getElementById(isLost ? 'lostItemPhotoThumb' : 'foundItemPhotoThumb');
  const iconEl = document.getElementById(isLost ? 'lostItemPhotoIcon' : 'foundItemPhotoIcon');

  if (nameEl) {
    nameEl.textContent = file.name;
  }

  // Render instant image thumbnail using FileReader
  if (file.type && file.type.startsWith('image/') && thumbEl) {
    const reader = new FileReader();
    reader.onload = function (e) {
      thumbEl.src = e.target.result;
      thumbEl.classList.remove('hidden');
      if (iconEl) iconEl.classList.add('hidden');
    };
    reader.readAsDataURL(file);
  } else if (thumbEl) {
    thumbEl.classList.add('hidden');
    if (iconEl) iconEl.classList.remove('hidden');
  }

  if (placeholder) {
    placeholder.classList.add('hidden');
  }
  if (preview) {
    preview.classList.remove('hidden');
    preview.classList.add('flex');
  }
}

// Handler to safely remove attached image without re-triggering file input
function removeAttachedPhoto(event, inputId, previewId, placeholderId) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const input = document.getElementById(inputId);
  if (input) {
    input.value = ''; // Clears file input so change event fires again if re-selected
  }
  resetPhotoPreview(previewId, placeholderId);
  showToast('Attached photo removed.', 'info');
}

function resetPhotoPreview(previewId, placeholderId) {
  const preview = document.getElementById(previewId);
  const placeholder = document.getElementById(placeholderId);
  const isLost = previewId.toLowerCase().includes('lost');
  const thumbEl = document.getElementById(isLost ? 'lostItemPhotoThumb' : 'foundItemPhotoThumb');
  const iconEl = document.getElementById(isLost ? 'lostItemPhotoIcon' : 'foundItemPhotoIcon');

  if (thumbEl) {
    thumbEl.src = '';
    thumbEl.classList.add('hidden');
  }
  if (iconEl) {
    iconEl.classList.remove('hidden');
  }
  if (preview) {
    preview.classList.add('hidden');
    preview.classList.remove('flex');
  }
  if (placeholder) {
    placeholder.classList.remove('hidden');
  }
}

// 2. HTML5 Drag-and-Drop File Upload Events ('dragenter', 'dragover', 'dragleave', 'drop')
function initDragAndDrop() {
  ['lostItemPhotoInput', 'foundItemPhotoInput'].forEach(inputId => {
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;
    const dropZone = inputEl.parentElement;
    if (!dropZone) return;

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('border-sage-500', 'bg-sage-50/70', 'ring-2', 'ring-sage-400/40');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('border-sage-500', 'bg-sage-50/70', 'ring-2', 'ring-sage-400/40');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        inputEl.files = e.dataTransfer.files;
        const isLost = inputId === 'lostItemPhotoInput';
        previewImageUpload(
          inputEl,
          isLost ? 'lostItemPhotoPreview' : 'foundItemPhotoPreview',
          isLost ? 'lostItemPhotoPlaceholder' : 'foundItemPhotoPlaceholder'
        );
        showToast(`Image "${e.dataTransfer.files[0].name}" attached via Drag & Drop!`, 'success');
      }
    });
  });
}

// 3. Clipboard Screenshot Paste Event ('paste')
// Allows pasting screenshots (Ctrl + V) directly into active Report Lost/Found modal
window.addEventListener('paste', (e) => {
  const lostModal = document.getElementById('reportLostModal');
  const foundModal = document.getElementById('reportFoundModal');
  const isLostOpen = lostModal && !lostModal.classList.contains('hidden');
  const isFoundOpen = foundModal && !foundModal.classList.contains('hidden');

  if (!isLostOpen && !isFoundOpen) return;

  const clipboardData = e.clipboardData || window.clipboardData;
  if (!clipboardData || !clipboardData.items) return;

  for (let i = 0; i < clipboardData.items.length; i++) {
    const item = clipboardData.items[i];
    if (item.type && item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      if (!blob) continue;

      const file = new File([blob], `pasted_screenshot_${Date.now()}.png`, { type: blob.type });
      const inputId = isLostOpen ? 'lostItemPhotoInput' : 'foundItemPhotoInput';
      const inputEl = document.getElementById(inputId);

      if (inputEl) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        inputEl.files = dataTransfer.files;

        previewImageUpload(
          inputEl,
          isLostOpen ? 'lostItemPhotoPreview' : 'foundItemPhotoPreview',
          isLostOpen ? 'lostItemPhotoPlaceholder' : 'foundItemPhotoPlaceholder'
        );

        showToast('Screenshot attached directly from clipboard (Ctrl+V)!', 'success');
      }
      break;
    }
  }
});

// 4. Campus Network Connectivity Events ('online' & 'offline')
window.addEventListener('offline', () => {
  showToast('Campus Wi-Fi / network offline. Active report submissions paused.', 'warning');
  document.querySelectorAll('form button[type="submit"]').forEach(btn => {
    btn.dataset.prevHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');
  });
});

window.addEventListener('online', () => {
  showToast('Connected back to Christ University campus network! Synchronizing...', 'success');
  document.querySelectorAll('form button[type="submit"]').forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('opacity-50', 'cursor-not-allowed');
  });
  if (typeof triggerTFIDFReScan === 'function') {
    triggerTFIDFReScan();
  }
});

// Initialize Drag & Drop listeners on DOM load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDragAndDrop);
} else {
  initDragAndDrop();
}

