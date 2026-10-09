/* ============================================
   تطبيق شجرة العائلة - JavaScript
   الجزء 1: الاستيراد + الإعداد + المتغيرات + الدوال المساعدة
   ============================================ */

// ===== 1. استيراد Firebase SDK =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


// ===== 2. إعداد Firebase =====
const firebaseConfig = {
  apiKey: "AIzaSyAyIhmjCXyoUeWfIXkv5yjZz2GnOR5vw9E",
  authDomain: "mulla-family-tree.firebaseapp.com",
  projectId: "mulla-family-tree",
  storageBucket: "mulla-family-tree.firebasestorage.app",
  messagingSenderId: "177486473203",
  appId: "1:177486473203:web:d69da800db4d2b45049486"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();


// ===== 3. المتغيرات العامة =====
const state = {
  user: null,
  familyId: null,
  familyMeta: null,
  role: null,
  persons: [],
  unions: [],
  parentChild: [],
  selectedPersonId: null,
  zoom: 1,
  panX: 0,
  panY: 0,
  isDark: false,
  isCompact: false,
  pin: null,
  unsubscribers: [],
  editingPersonId: null,
  relationFromPersonId: null
};


// ===== 4. الثوابت =====
const COLLECTIONS = {
  FAMILIES: "families",
  META: "meta",
  MEMBERS: "members",
  PERSONS: "persons",
  UNIONS: "unions",
  PARENT_CHILD: "parent_child",
  HISTORY: "history"
};

const ROLES = {
  OWNER: "owner",
  EDITOR: "editor",
  VIEWER: "viewer"
};

const RELATION_TYPES = {
  BIOLOGICAL: "biological",
  ADOPTED: "adopted",
  FOSTERED: "fostered"
};

const STORAGE_KEYS = {
  FAMILY_ID: "ft_familyId",
  USER_ID: "ft_userId",
  THEME: "ft_theme",
  COMPACT: "ft_compact",
  PIN: "ft_pin",
  PLATFORM_NAME: "ft_platformName"
};


// ===== 5. الدوال المساعدة =====

function generateId(prefix = "") {
  return prefix + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function showToast(message, type = "info", duration = 3000) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(20px)";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function show(el) {
  if (typeof el === "string") el = document.getElementById(el);
  if (el) el.classList.remove("hidden");
}

function hide(el) {
  if (typeof el === "string") el = document.getElementById(el);
  if (el) el.classList.add("hidden");
}

function formatDate(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getInitials(name) {
  if (!name) return "؟";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0);
  return parts[0].charAt(0) + " " + parts[parts.length - 1].charAt(0);
}

function canEdit() {
  return state.role === ROLES.OWNER || state.role === ROLES.EDITOR;
}

function isOwner() {
  return state.role === ROLES.OWNER;
}

function getPersonById(id) {
  return state.persons.find(p => p.id === id) || null;
}

function getPersonName(id) {
  const person = getPersonById(id);
  return person ? person.name : "غير معروف";
}

function sortPersonsByName(persons) {
  return [...persons].sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}


// ===== 6. التخزين المحلي =====
const storage = {
  get(key, fallback = null) {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("localStorage error:", e);
    }
  },
  remove(key) {
    localStorage.removeItem(key);
  }
};


// ===== 7. تهيئة التطبيق =====
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 بدء التطبيق...");
  initTheme();
  initCompact();
  initAuth();
});

function initTheme() {
  const saved = storage.get(STORAGE_KEYS.THEME, false);
  if (saved) {
    document.body.classList.add("dark");
    state.isDark = true;
  }
}

function initCompact() {
  const saved = storage.get(STORAGE_KEYS.COMPACT, false);
  if (saved) {
    document.body.classList.add("compact");
    state.isCompact = true;
  }
}

console.log("✅ الجزء 1 محمّل");
/* ============================================
   الجزء 2: المصادقة + تحميل البيانات + الانضمام
   ============================================ */

// ===== 8. تهيئة المصادقة =====
function initAuth() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log("✅ مستخدم مسجل:", user.uid);
      state.user = user;
      storage.set(STORAGE_KEYS.USER_ID, user.uid);
      await handleUserLoggedIn(user);
    } else {
      console.log("⚠️ لا يوجد مستخدم");
      state.user = null;
      storage.remove(STORAGE_KEYS.USER_ID);
      showWelcomeScreen();
    }
  });
}


// ===== 9. عند تسجيل الدخول =====
async function handleUserLoggedIn(user) {
  try {
    hide("loadingScreen");

    const savedPin = storage.get(STORAGE_KEYS.PIN, null);
    if (savedPin) {
      state.pin = savedPin;
      showPinModal("أدخل الرمز السري للدخول", async (enteredPin) => {
        if (enteredPin === savedPin) {
          hide("pinModal");
          await proceedAfterAuth(user);
        } else {
          showToast("❌ الرمز غير صحيح", "error");
        }
      });
      return;
    }

    await proceedAfterAuth(user);
  } catch (error) {
    console.error("خطأ في تسجيل الدخول:", error);
    showToast("حدث خطأ أثناء تسجيل الدخول", "error");
  }
}


// ===== 10. المتابعة بعد المصادقة =====
async function proceedAfterAuth(user) {
  // 1. إذا كان قادماً من "الدخول بكود"
  const pendingCode = storage.get("pendingJoinCode", null);
  const pendingName = storage.get("pendingJoinName", null);

  if (pendingCode) {
    storage.remove("pendingJoinCode");
    storage.remove("pendingJoinName");
    await joinFamilyByCode(pendingCode, pendingName);
    return;
  }

  // 2. ابحث عن عائلة المستخدم
  const familyId = await findUserFamily(user.uid);
  if (familyId) {
    state.familyId = familyId;
    storage.set(STORAGE_KEYS.FAMILY_ID, familyId);
    await loadFamilyData(familyId);
    showMainApp();
    return;
  }

  // 3. أنشئ عائلة جديدة (فقط للمالك عبر Google)
  if (user.email || user.providerData.some(p => p.providerId === "google.com")) {
    await createNewFamily(user);
  } else {
    showToast("❌ يجب الدخول بحساب Google أو بكود دعوة", "error");
    setTimeout(() => {
      cleanupListeners();
      signOut(auth);
    }, 2000);
  }
}


// ===== 11. البحث عن عائلة المستخدم =====
async function findUserFamily(userId) {
  const cachedFamilyId = storage.get(STORAGE_KEYS.FAMILY_ID, null);
  if (cachedFamilyId) {
    try {
      const familyRef = doc(db, COLLECTIONS.FAMILIES, cachedFamilyId);
      const familySnap = await getDoc(familyRef);
      if (familySnap.exists()) return cachedFamilyId;
    } catch (e) {}
  }

  if (state.user && state.user.email) {
    try {
      const familiesSnap = await getDocs(collection(db, COLLECTIONS.FAMILIES));
      for (const familyDoc of familiesSnap.docs) {
        const membersRef = collection(db, COLLECTIONS.FAMILIES, familyDoc.id, COLLECTIONS.MEMBERS);
        const membersSnap = await getDocs(membersRef);
        for (const memberDoc of membersSnap.docs) {
          const data = memberDoc.data();
          if (data.email && data.email.toLowerCase() === state.user.email.toLowerCase()) {
            return familyDoc.id;
          }
        }
      }
    } catch (e) {}
  }

  try {
    const familiesSnap = await getDocs(collection(db, COLLECTIONS.FAMILIES));
    for (const familyDoc of familiesSnap.docs) {
      const memberRef = doc(db, COLLECTIONS.FAMILIES, familyDoc.id, COLLECTIONS.MEMBERS, userId);
      const memberSnap = await getDoc(memberRef);
      if (memberSnap.exists()) return familyDoc.id;
    }
  } catch (e) {}

  return null;
}


// ===== 12. إنشاء عائلة جديدة =====
async function createNewFamily(user) {
  try {
    showToast("جارٍ إنشاء عائلة جديدة...", "info");

    const familyId = generateId("fam_");
    const editorCode = generateInviteCode();
    const viewerCode = generateInviteCode();
    const platformName = "شجرة أنساب الفادنية شرق";

    const familyRef = doc(db, COLLECTIONS.FAMILIES, familyId);
    await setDoc(familyRef, {
      name: platformName,
      editorCode: editorCode,
      viewerCode: viewerCode,
      ownerId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    const metaRef = doc(db, COLLECTIONS.FAMILIES, familyId, COLLECTIONS.META, "info");
    await setDoc(metaRef, {
      name: platformName,
      editorCode: editorCode,
      viewerCode: viewerCode,
      ownerId: user.uid,
      createdAt: serverTimestamp()
    });

    const memberRef = doc(db, COLLECTIONS.FAMILIES, familyId, COLLECTIONS.MEMBERS, user.uid);
    await setDoc(memberRef, {
      userId: user.uid,
      email: user.email || null,
      displayName: user.displayName || "المالك",
      role: ROLES.OWNER,
      joinedAt: serverTimestamp()
    });

    state.familyId = familyId;
    state.role = ROLES.OWNER;
    storage.set(STORAGE_KEYS.FAMILY_ID, familyId);
    storage.set(STORAGE_KEYS.PLATFORM_NAME, platformName);

    await loadFamilyData(familyId);
    showMainApp();
    showToast("✅ تم إنشاء العائلة", "success");
  } catch (error) {
    console.error("خطأ في إنشاء العائلة:", error);
    showToast("❌ فشل إنشاء العائلة", "error");
  }
}


// ===== 13. تحميل بيانات العائلة =====
async function loadFamilyData(familyId) {
  try {
    console.log("📥 تحميل:", familyId);

    const metaRef = doc(db, COLLECTIONS.FAMILIES, familyId, COLLECTIONS.META, "info");
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists()) {
      state.familyMeta = metaSnap.data();
      if (state.familyMeta.name) updatePlatformTitle(state.familyMeta.name);
    }

    const memberRef = doc(db, COLLECTIONS.FAMILIES, familyId, COLLECTIONS.MEMBERS, state.user.uid);
const memberSnap = await getDoc(memberRef);
const savedRole = storage.get("userRole", null);
if (memberSnap.exists()) {
  state.role = memberSnap.data().role || savedRole || ROLES.VIEWER;
} else if (savedRole) {
  state.role = savedRole;
} else {
  state.role = ROLES.VIEWER;
}

   // تحقق: إذا كان ownerId مطابقاً، فهو مالك
const familyRef = doc(db, COLLECTIONS.FAMILIES, familyId);
const familySnap = await getDoc(familyRef);
if (familySnap.exists() && familySnap.data().ownerId === state.user.uid) {
  state.role = ROLES.OWNER;
}
    startRealtimeListeners(familyId);
  } catch (error) {
    console.error("خطأ في التحميل:", error);
  }
}


// ===== 14. المستمعين الفوريين =====
function startRealtimeListeners(familyId) {
  const personsRef = collection(db, COLLECTIONS.FAMILIES, familyId, COLLECTIONS.PERSONS);
  const unsubPersons = onSnapshot(personsRef, (snapshot) => {
    state.persons = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log("👥 الأفراد:", state.persons.length);
    updateStats();
    renderTree();
  });
  state.unsubscribers.push(unsubPersons);

  const unionsRef = collection(db, COLLECTIONS.FAMILIES, familyId, COLLECTIONS.UNIONS);
  const unsubUnions = onSnapshot(unionsRef, (snapshot) => {
    state.unions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTree();
  });
  state.unsubscribers.push(unsubUnions);

  const pcRef = collection(db, COLLECTIONS.FAMILIES, familyId, COLLECTIONS.PARENT_CHILD);
  const unsubPC = onSnapshot(pcRef, (snapshot) => {
    state.parentChild = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTree();
  });
  state.unsubscribers.push(unsubPC);

  const metaRef = doc(db, COLLECTIONS.FAMILIES, familyId, COLLECTIONS.META, "info");
  const unsubMeta = onSnapshot(metaRef, (snapshot) => {
    if (snapshot.exists()) {
      state.familyMeta = snapshot.data();
      if (state.familyMeta.name) updatePlatformTitle(state.familyMeta.name);
      updateSettingsUI();
    }
  });
  state.unsubscribers.push(unsubMeta);
}


// ===== 15. تنظيف المستمعين =====
function cleanupListeners() {
  state.unsubscribers.forEach(unsub => {
    try { unsub(); } catch (e) {}
  });
  state.unsubscribers = [];
}


// ===== 16. الدخول والخروج =====

async function handleGoogleLogin() {
  try {
    showToast("جارٍ تسجيل الدخول...", "info");
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (error.code === "auth/popup-closed-by-user") {
      showToast("تم الإلغاء", "warning");
    } else {
      showToast("❌ فشل تسجيل الدخول", "error");
    }
  }
}

async function handleLogout() {
  try {
    await signOut(auth);
    cleanupListeners();
    storage.remove(STORAGE_KEYS.USER_ID);
    showToast("تم تسجيل الخروج", "info");
    setTimeout(() => location.reload(), 800);
  } catch (error) {
    console.error("خطأ في الخروج:", error);
  }
}


// ===== 17. عرض الشاشات =====
function showWelcomeScreen() {
  hide("loadingScreen");
  hide("mainApp");
  show("welcomeScreen");
}

function showMainApp() {
  hide("loadingScreen");
  hide("welcomeScreen");
  show("mainApp");
}


// ===== 18. تحديث عنوان المنصة =====
function updatePlatformTitle(name) {
  const titleEl = document.getElementById("platformTitle");
  if (titleEl) titleEl.textContent = name;
  document.title = name;
  storage.set(STORAGE_KEYS.PLATFORM_NAME, name);
}


// ===== 19. تحديث الإحصائيات =====
function updateStats() {
  const statsEl = document.getElementById("statsText");
  if (statsEl) statsEl.textContent = `عدد الأفراد: ${state.persons.length}`;

  const emptyEl = document.getElementById("treeEmpty");
  if (emptyEl) {
    if (state.persons.length === 0) show(emptyEl);
    else hide(emptyEl);
  }
}


// ===== 20. الانضمام بكود =====
async function joinFamilyByCode(code, userName) {
  if (!code) {
    showToast("❌ أدخل الكود", "error");
    return false;
  }

  const upperCode = code.toUpperCase().trim();

  try {
    showToast("⏳ جارٍ البحث...", "info");

    const familiesSnap = await getDocs(collection(db, COLLECTIONS.FAMILIES));
    let targetFamily = null;
    let role = null;

    for (const familyDoc of familiesSnap.docs) {
      const data = familyDoc.data();

      if (data.editorCode && data.editorCode.toString().trim().toUpperCase() === upperCode) {
        targetFamily = familyDoc.id;
        role = ROLES.EDITOR;
        break;
      }
      if (data.viewerCode && data.viewerCode.toString().trim().toUpperCase() === upperCode) {
        targetFamily = familyDoc.id;
        role = ROLES.VIEWER;
        break;
      }
    }

    if (!targetFamily) {
      showToast("❌ كود غير صحيح", "error");
      return false;
    }

    const memberRef = doc(db, COLLECTIONS.FAMILIES, targetFamily, COLLECTIONS.MEMBERS, state.user.uid);
    await setDoc(memberRef, {
      userId: state.user.uid,
      email: state.user.email || null,
      displayName: userName || (role === ROLES.EDITOR ? "محرر" : "مشاهد"),
      role: role,
      joinedAt: serverTimestamp()
    });

    state.familyId = targetFamily;
    state.role = role;
    storage.set(STORAGE_KEYS.FAMILY_ID, targetFamily);
    storage.set("userRole", role);

    await loadFamilyData(targetFamily);
    showMainApp();

    const roleName = role === ROLES.EDITOR ? "محرر" : "مشاهد";
    showToast(`✅ تم الانضمام كـ ${roleName}`, "success");
    return true;
  } catch (error) {
    console.error("خطأ في الانضمام:", error);
    showToast("❌ فشل الانضمام", "error");
    return false;
  }
}
// ===== 21. فتح نافذة الانضمام =====
function openJoinModal() {
  const jm = document.getElementById("joinModal");
  if (!jm) return;

  jm.style.display = "flex";

  const codeInput = document.getElementById("inputJoinCode");
  const nameInput = document.getElementById("inputJoinName");
  if (codeInput) codeInput.value = "";
  if (nameInput) nameInput.value = "";
  if (titleInput) titleInput.value = "";

  setTimeout(() => codeInput && codeInput.focus(), 300);
}

function closeJoinModal() {
  const jm = document.getElementById("joinModal");
  if (jm) jm.style.display = "none";
}

async function confirmJoin() {
  const codeInput = document.getElementById("inputJoinCode");
  const nameInput = document.getElementById("inputJoinName");
  const code = codeInput ? codeInput.value.trim() : "";
  const name = nameInput ? nameInput.value.trim() : "";

  if (!code) {
    showToast("❌ أدخل الكود", "error");
    return;
  }

  storage.set("pendingJoinCode", code);
  storage.set("pendingJoinName", name);

  hide("joinModal");

  const familiesSnap = await getDocs(collection(db, COLLECTIONS.FAMILIES));
let targetFamily = null;
let role = null;

for (const familyDoc of familiesSnap.docs) {
  const data = familyDoc.data();
  if (data.editorCode && data.editorCode.toString().trim().toUpperCase() === code.toUpperCase()) {
    targetFamily = familyDoc.id;
    role = ROLES.EDITOR;
    break;
  }
  if (data.viewerCode && data.viewerCode.toString().trim().toUpperCase() === code.toUpperCase()) {
    targetFamily = familyDoc.id;
    role = ROLES.VIEWER;
    break;
  }
}

if (!targetFamily) {
  showToast("❌ كود غير صحيح", "error");
  storage.remove("pendingJoinCode");
  storage.remove("pendingJoinName");
  return;
}

if (role === ROLES.EDITOR) {
  if (!state.user || !state.user.email) {
    try {
      await signInWithPopup(auth, googleProvider);
      return;
    } catch (error) {
      showToast("❌ يجب تسجيل Google للمحرر", "error");
      return;
    }
  }
} else {
  if (!state.user) {
    try {
      await signInAnonymously(auth);
    } catch (error) {
      showToast("❌ فشل الدخول", "error");
      return;
    }
  }
}

await joinFamilyByCode(code, name);
storage.remove("pendingJoinCode");
storage.remove("pendingJoinName");
}

console.log("✅ الجزء 2 محمّل");
/* ============================================
   الجزء 3: CRUD للأفراد + العلاقات + السجل + الإعدادات
   ============================================ */

// ===== 22. إضافة فرد =====
async function addPerson(personData) {
  if (!canEdit()) {
    showToast("❌ ليس لديك صلاحية", "error");
    return null;
  }

  try {
    const personId = generateId("p_");
    const personRef = doc(db, COLLECTIONS.FAMILIES, state.familyId, COLLECTIONS.PERSONS, personId);

    const newPerson = {
      name: personData.name.trim(),
      gender: personData.gender || "male",
      fatherId: personData.fatherId || null,
      motherId: personData.motherId || null,
      birthYear: personData.birthYear || null,
      deathYear: personData.deathYear || null,
      isAlive: personData.isAlive || "alive",
      relationType: personData.relationType || "biological",
      notes: personData.notes || "",
      order: Date.now(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: state.user.uid
    };

    await setDoc(personRef, newPerson);
    await logHistory("add", `إضافة فرد: ${newPerson.name}`);
    showToast("✅ تم الإضافة", "success");
    return personId;
  } catch (error) {
    console.error("خطأ:", error);
    showToast("❌ فشل الإضافة", "error");
    return null;
  }
}


// ===== 23. تعديل فرد =====
async function updatePerson(personId, updates) {
  if (!canEdit()) {
    showToast("❌ ليس لديك صلاحية", "error");
    return false;
  }

  try {
    const personRef = doc(db, COLLECTIONS.FAMILIES, state.familyId, COLLECTIONS.PERSONS, personId);
    await updateDoc(personRef, { ...updates, updatedAt: serverTimestamp() });
    await logHistory("update", `تعديل فرد: ${updates.name || personId}`);
    showToast("✅ تم التعديل", "success");
    return true;
  } catch (error) {
    console.error("خطأ:", error);
    showToast("❌ فشل التعديل", "error");
    return false;
  }
}


// ===== 24. حذف فرد =====
async function deletePerson(personId) {
  if (!isOwner()) {
    showToast("❌ الحذف للمالك فقط", "error");
    return false;
  }

  const person = getPersonById(personId);
  if (!person) return false;

  try {
    const personRef = doc(db, COLLECTIONS.FAMILIES, state.familyId, COLLECTIONS.PERSONS, personId);
    await deleteDoc(personRef);
    await deleteRelatedRelations(personId);
    await logHistory("delete", `حذف فرد: ${person.name}`);
    showToast("✅ تم الحذف", "success");
    return true;
  } catch (error) {
    console.error("خطأ:", error);
    showToast("❌ فشل الحذف", "error");
    return false;
  }
}


// ===== 25. حذف العلاقات المرتبطة =====
async function deleteRelatedRelations(personId) {
  const batch = writeBatch(db);

  state.parentChild.forEach(rel => {
    if (rel.parentId === personId || rel.childId === personId) {
      batch.delete(doc(db, COLLECTIONS.FAMILIES, state.familyId, COLLECTIONS.PARENT_CHILD, rel.id));
    }
  });

  state.unions.forEach(union => {
    if (union.husbandId === personId || union.wifeId === personId) {
      batch.delete(doc(db, COLLECTIONS.FAMILIES, state.familyId, COLLECTIONS.UNIONS, union.id));
    }
  });

  await batch.commit();
}


// ===== 26. إضافة علاقة أب/ابن =====
async function addParentChildRelation(parentId, childId, relationType = "biological") {
  if (!canEdit()) return false;

  try {
    const relationId = generateId("pc_");
    const relRef = doc(db, COLLECTIONS.FAMILIES, state.familyId, COLLECTIONS.PARENT_CHILD, relationId);
    await setDoc(relRef, {
      parentId: parentId,
      childId: childId,
      relationType: relationType,
      createdAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error("خطأ:", error);
    return false;
  }
}


// ===== 27. إضافة زواج =====
async function addUnion(husbandId, wifeId, status = "married") {
  if (!canEdit()) return false;

  try {
    const unionId = generateId("u_");
    const unionRef = doc(db, COLLECTIONS.FAMILIES, state.familyId, COLLECTIONS.UNIONS, unionId);
    await setDoc(unionRef, {
      husbandId: husbandId,
      wifeId: wifeId,
      status: status,
      createdAt: serverTimestamp()
    });
    await logHistory("add_union", `زواج ${getPersonName(husbandId)} و ${getPersonName(wifeId)}`);
    return true;
  } catch (error) {
    console.error("خطأ:", error);
    return false;
  }
}


// ===== 28. الحصول على الأبناء =====
function getChildren(personId) {
  const childIds = new Set();
  state.parentChild.forEach(rel => {
    if (rel.parentId === personId) childIds.add(rel.childId);
  });
  state.persons.forEach(p => {
    if (p.fatherId === personId || p.motherId === personId) childIds.add(p.id);
  });
  return state.persons.filter(p => childIds.has(p.id));
}


// ===== 29. الحصول على الأزواج =====
function getSpouses(personId) {
  const spouses = [];
  state.unions.forEach(union => {
    let spouseId = null;
    if (union.husbandId === personId) spouseId = union.wifeId;
    else if (union.wifeId === personId) spouseId = union.husbandId;

    if (spouseId) {
      const spouse = getPersonById(spouseId);
      if (spouse) {
        spouses.push({ ...spouse, status: union.status || "married", unionId: union.id });
      }
    }
  });
  return spouses;
}


// ===== 30. الحصول على معرّف الوالد =====
function getParentId(person) {
  if (person.fatherId) return person.fatherId;
  if (person.motherId) return person.motherId;
  return null;
}


// ===== 31. سجل التعديلات =====
async function logHistory(action, description) {
  try {
    const historyRef = collection(db, COLLECTIONS.FAMILIES, state.familyId, COLLECTIONS.HISTORY);
    await addDoc(historyRef, {
      action: action,
      description: description,
      userId: state.user.uid,
      userName: state.user.displayName || "مجهول",
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.warn("فشل تسجيل التاريخ:", error);
  }
}


async function loadHistory() {
  try {
    const historyRef = collection(db, COLLECTIONS.FAMILIES, state.familyId, COLLECTIONS.HISTORY);
    const snapshot = await getDocs(historyRef);
    const history = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

    const listEl = document.getElementById("historyList");
    if (!listEl) return;

    if (history.length === 0) {
      listEl.innerHTML = "<p class='stats-text'>لا يوجد سجل</p>";
      return;
    }

    listEl.innerHTML = history.slice(0, 100).map(item => `
      <div class="history-item">
        <div>${item.description || ""}</div>
        <div class="history-time">${formatDate(item.timestamp)} • ${item.userName || ""}</div>
      </div>
    `).join("");
  } catch (error) {
    console.error("خطأ:", error);
  }
}


// ===== 32. تحديث واجهة الإعدادات =====
function updateSettingsUI() {
  if (state.familyMeta) {
    const nameInput = document.getElementById("inputPlatformName");
    if (nameInput) nameInput.value = state.familyMeta.name || "";
  }

  const roleInput = document.getElementById("selectRole");
  if (roleInput) {
    const roleNames = { "owner": "👑 مالك", "editor": "✏️ محرر", "viewer": "👁️ مشاهد" };
    roleInput.value = roleNames[state.role] || "غير معروف";
  }

  const editorInput = document.getElementById("editorCodeInput");
  if (editorInput && state.familyMeta) {
    editorInput.value = state.familyMeta.editorCode || "";
  }

  const viewerInput = document.getElementById("viewerCodeInput");
  if (viewerInput && state.familyMeta) {
    viewerInput.value = state.familyMeta.viewerCode || "";
  }
}

console.log("✅ الجزء 3 محمّل");
/* ============================================
   الجزء 4: رسم الشجرة + التكبير/التحريك
   ============================================ */

const NODE_WIDTH = 120;
const NODE_HEIGHT = 90;
const H_GAP = 120;
const V_GAP = 100;


// ===== 33. رسم الشجرة =====
function renderTree() {
  const canvas = document.getElementById("treeCanvas");
  if (!canvas) return;

  canvas.innerHTML = "";

  if (state.persons.length === 0) return;

  const roots = findRootPersons();
  if (roots.length === 0) return;

  const layout = [];
  let currentX = 50;
  let maxDepth = 0;

  roots.forEach(root => {
    const result = layoutSubtree(root, currentX, 50, 0);
    layout.push(...result.nodes);
    currentX = result.nextX + H_GAP * 2;
    maxDepth = Math.max(maxDepth, result.maxDepth);
  });

  const totalWidth = Math.max(currentX + 200, 400);
  const totalHeight = (maxDepth + 1) * (NODE_HEIGHT + V_GAP) + 100;
  canvas.style.width = totalWidth + "px";
  canvas.style.height = totalHeight + "px";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "tree-lines");
  svg.setAttribute("width", totalWidth);
  svg.setAttribute("height", totalHeight);
  canvas.appendChild(svg);

  layout.forEach(node => {
    const parent = layout.find(n => n.id === node.parentId);
    if (parent) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const x1 = parent.x + NODE_WIDTH / 2;
      const y1 = parent.y + NODE_HEIGHT;
      const x2 = node.x + NODE_WIDTH / 2;
      const y2 = node.y;
      const midY = (y1 + y2) / 2;
      if (Math.abs(x1 - x2) < 100)  {
  line.setAttribute("d", `M ${x1} ${y1} L ${x2} ${y2}`);
} else {
  line.setAttribute("d", `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`);
}
      line.setAttribute("stroke", "#d4af37");
      line.setAttribute("stroke-width", "2.5");
      line.setAttribute("fill", "none");
      svg.appendChild(line);
    }
  });

  layout.forEach(node => {
    const person = getPersonById(node.id);
    if (!person) return;

    const nodeEl = document.createElement("div");
    nodeEl.className = `tree-node ${person.gender === "female" ? "female" : ""}`;
    if (person.isAlive === "deceased") nodeEl.classList.add("deceased");
    if (state.selectedPersonId === person.id) nodeEl.classList.add("selected");
    nodeEl.style.left = node.x + "px";
    nodeEl.style.top = node.y + "px";
    nodeEl.style.width = NODE_WIDTH + "px";
    nodeEl.dataset.personId = person.id;

    let badgeHtml = "";
    if (person.relationType === "adopted") badgeHtml = '<span class="tree-node-badge">تبنّي</span>';
    if (person.relationType === "fostered") badgeHtml = '<span class="tree-node-badge">كفالة</span>';
    if (person.isAlive === "deceased") badgeHtml = '<span class="tree-node-badge">متوفى</span>';

const level = getPersonLevel(person.id);

    nodeEl.innerHTML = `
  <div class="tree-node-card">
    <div class="tree-node-level">${level}</div>
    ${badgeHtml}
    <div class="tree-node-name">${escapeHtml(person.name)}</div>
    ${person.title ? `<div class="tree-node-title">${escapeHtml(person.title)}</div>` : ""}
  </div>
`;

    nodeEl.addEventListener("click", (e) => {
      e.stopPropagation();
      openPersonCard(person.id);
    });


  // ... باقي الكود
    let longPressTimer;
    nodeEl.addEventListener("touchstart", (e) => {
      longPressTimer = setTimeout(() => {
        e.preventDefault();
        openPieMenu(person.id);
      }, 600);
    }, { passive: false });

    nodeEl.addEventListener("touchend", () => clearTimeout(longPressTimer));
    nodeEl.addEventListener("touchmove", () => clearTimeout(longPressTimer));

    nodeEl.addEventListener("mousedown", () => {
      longPressTimer = setTimeout(() => openPieMenu(person.id), 600);
    });
    nodeEl.addEventListener("mouseup", () => clearTimeout(longPressTimer));
    nodeEl.addEventListener("mouseleave", () => clearTimeout(longPressTimer));

    canvas.appendChild(nodeEl);
  });

  applyTransform();
}


// ===== 34. إيجاد الجذور =====
function findRootPersons() {
  const rootIds = new Set();
  state.persons.forEach(p => {
    if (!p.fatherId && !p.motherId) rootIds.add(p.id);
  });
  return state.persons.filter(p => rootIds.has(p.id));
}


// ===== 35. تخطيط الشجرة =====
function layoutSubtree(person, startX, startY, depth) {
  const children = getChildren(person.id);
  const nodes = [];
  let maxDepth = depth;

  if (children.length === 0) {
    nodes.push({ id: person.id, x: startX, y: startY, parentId: getParentId(person) });
    return { nodes, nextX: startX, maxDepth };
  }

  children.sort((a, b) => (a.order || 0) - (b.order || 0));

  let childX = startX;
  const childResults = [];

  children.forEach(child => {
    const result = layoutSubtree(child, childX, startY + NODE_HEIGHT + V_GAP, depth + 1);
    childResults.push(result);
    nodes.push(...result.nodes);
    childX = result.nextX + H_GAP;
    maxDepth = Math.max(maxDepth, result.maxDepth);
  });

  const firstChildX = childResults[0].nodes[0].x;
const lastChildResult = childResults[childResults.length - 1];
const lastChildNodes = lastChildResult.nodes.filter(n => n.y === startY + NODE_HEIGHT + V_GAP);
const lastChildX = lastChildNodes.length > 0 ? lastChildNodes[0].x : firstChildX;
const parentX = firstChildX;
  nodes.push({ id: person.id, x: parentX, y: startY, parentId: getParentId(person) });

  const nextX = Math.max(childX, parentX + NODE_WIDTH);
  return { nodes, nextX, maxDepth };
}


// ===== 36. التكبير والتحريك =====
let touchState = {
  isPanning: false, isPinching: false,
  startX: 0, startY: 0, initialPanX: 0, initialPanY: 0,
  initialDistance: 0, initialZoom: 1
};

function initZoomPan() {
  const container = document.getElementById("treeContainer");
  if (!container) return;

  container.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      touchState.isPanning = true;
      touchState.startX = e.touches[0].clientX;
      touchState.startY = e.touches[0].clientY;
      touchState.initialPanX = state.panX;
      touchState.initialPanY = state.panY;
    } else if (e.touches.length === 2) {
      touchState.isPinching = true;
      touchState.isPanning = false;
      touchState.initialDistance = getTouchDistance(e.touches[0], e.touches[1]);
      touchState.initialZoom = state.zoom;
    }
  }, { passive: true });

  container.addEventListener("touchmove", (e) => {
    if (touchState.isPinching && e.touches.length === 2) {
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      const scale = distance / touchState.initialDistance;
      state.zoom = Math.max(0.3, Math.min(3, touchState.initialZoom * scale));
      applyTransform();
      if (state.zoom > 1.2) hideActionBar(); else showActionBar();
    } else if (touchState.isPanning && e.touches.length === 1) {
      state.panX = touchState.initialPanX + (e.touches[0].clientX - touchState.startX);
      state.panY = touchState.initialPanY + (e.touches[0].clientY - touchState.startY);
      applyTransform();
    }
  }, { passive: true });

  container.addEventListener("touchend", () => {
    touchState.isPanning = false;
    touchState.isPinching = false;
  });

  container.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    state.zoom = Math.max(0.3, Math.min(3, state.zoom * delta));
    applyTransform();
    if (state.zoom > 1.2) hideActionBar(); else showActionBar();
  }, { passive: false });

  let isMouseDown = false;
  let mouseStartX, mouseStartY, mouseInitialPanX, mouseInitialPanY;

  container.addEventListener("mousedown", (e) => {
    if (e.target.closest(".tree-node")) return;
    isMouseDown = true;
    mouseStartX = e.clientX;
    mouseStartY = e.clientY;
    mouseInitialPanX = state.panX;
    mouseInitialPanY = state.panY;
    container.style.cursor = "grabbing";
  });

  window.addEventListener("mousemove", (e) => {
    if (!isMouseDown) return;
    state.panX = mouseInitialPanX + (e.clientX - mouseStartX);
    state.panY = mouseInitialPanY + (e.clientY - mouseStartY);
    applyTransform();
  });

  window.addEventListener("mouseup", () => {
    isMouseDown = false;
    container.style.cursor = "";
  });

  container.addEventListener("dblclick", (e) => {
    if (e.target.closest(".tree-node")) return;
    resetZoom();
  });
}

function applyTransform() {
  const canvas = document.getElementById("treeCanvas");
  if (!canvas) return;

  if (state._rafPending) return;
  state._rafPending = true;

  requestAnimationFrame(() => {
    canvas.style.transform = `translate3d(${state.panX}px, ${state.panY}px, 0) scale(${state.zoom})`;
    state._rafPending = false;
  });
}

function resetZoom() {
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  applyTransform();
  showActionBar();
}

function getTouchDistance(t1, t2) {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}


// ===== 37. إخفاء/إظهار الشريط =====
function hideActionBar() {
  const header = document.getElementById("appHeader");
  const actionBar = document.getElementById("actionBar");
  const fab = document.getElementById("fabMenu");
  if (header) header.classList.add("hide");
  if (actionBar) actionBar.classList.add("hide");
  if (fab) show(fab);
}

function showActionBar() {
  const header = document.getElementById("appHeader");
  const actionBar = document.getElementById("actionBar");
  const fab = document.getElementById("fabMenu");
  if (header) header.classList.remove("hide");
  if (actionBar) actionBar.classList.remove("hide");
  if (fab) hide(fab);
}

console.log("✅ الجزء 4 محمّل");
/* ============================================
   الجزء 5: البطاقة السفلية + القائمة الدائرية + الإضافة السريعة
   ============================================ */

// ===== 38. البطاقة السفلية =====
function openPersonCard(personId) {
  if (state.relationMode) {
    handleRelationClick(personId);
    return;
  }

  const person = getPersonById(personId);
  

  state.selectedPersonId = personId;
  focusOnPerson(personId);

  const body = document.getElementById("bottomSheetBody");
  if (!body) return;

  const father = person.fatherId ? getPersonById(person.fatherId) : null;
  const mother = person.motherId ? getPersonById(person.motherId) : null;
  const children = getChildren(personId);
  const spouses = getSpouses(personId);

  let relationBadge = "";
  if (person.relationType === "adopted") relationBadge = " 🟡 تبنّي";
  if (person.relationType === "fostered") relationBadge = " 🔵 كفالة";

  const statusBadge = person.isAlive === "deceased" ? "⚫ متوفى" : "🟢 حي";

  body.innerHTML = `
    <div class="person-card">
      <div class="person-card-header">
        <div class="person-avatar">${getInitials(person.name)}</div>
        <div class="person-info">
          <div class="person-name">${escapeHtml(person.name)}${relationBadge}</div>
          <div class="person-meta">
            ${person.gender === "female" ? "👩 أنثى" : "👨 ذكر"}
            ${person.birthYear ? " • 🎂 " + person.birthYear : ""}
            • ${statusBadge}
            ${person.deathYear ? " (توفي " + person.deathYear + ")" : ""}
          </div>
        </div>
      </div>

      <div class="person-details">
        <div class="detail-row">
          <span class="detail-label">👨 الأب:</span>
          <span>${father ? escapeHtml(father.name) : "غير معروف"}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">👩 الأم:</span>
          <span>${mother ? escapeHtml(mother.name) : "غير معروفة"}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">💍 الأزواج:</span>
          <span>${spouses.length > 0 ? spouses.map(s => escapeHtml(s.name)).join("، ") : "لا يوجد"}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">👶 الأبناء:</span>
          <span>${children.length > 0 ? children.length + " فرد" : "لا يوجد"}</span>
        </div>
        ${person.notes ? `<div class="detail-row"><span class="detail-label">📝 ملاحظات:</span><span>${escapeHtml(person.notes)}</span></div>` : ""}
      </div>

      ${canEdit() ? `
        <div class="detail-actions">
          <button class="btn-secondary" id="cardEditBtn">✏️ تعديل</button>
          <button class="btn-secondary" id="cardRelationBtn">➕ إضافة علاقة</button>
          ${isOwner() ? `<button class="btn-secondary" id="cardDeleteBtn">🗑️ حذف</button>` : ""}
        </div>
      ` : ""}
    </div>
  `;

  const editBtn = document.getElementById("cardEditBtn");
  const relationBtn = document.getElementById("cardRelationBtn");
  const deleteBtn = document.getElementById("cardDeleteBtn");

  if (editBtn) editBtn.addEventListener("click", () => {
    hide("bottomSheet");
    openPersonModal(person.id);
  });

  if (relationBtn) relationBtn.addEventListener("click", () => {
    hide("bottomSheet");
    openRelationModal(person.id);
  });

  if (deleteBtn) deleteBtn.addEventListener("click", async () => {
    if (confirm(`هل أنت متأكد من حذف "${person.name}"؟`)) {
      hide("bottomSheet");
      await deletePerson(person.id);
    }
  });

  show("bottomSheet");
}


// ===== 39. القائمة الدائرية =====
function openPieMenu(personId) {
  const person = getPersonById(personId);
  if (!person) return;

  closePieMenu();

  const node = document.querySelector(`.tree-node[data-person-id="${personId}"]`);
  if (!node) return;

  const rect = node.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const pieMenu = document.createElement("div");
  pieMenu.className = "pie-menu";
  pieMenu.id = "pieMenu";

  const overlay = document.createElement("div");
  overlay.className = "pie-overlay";
  overlay.addEventListener("click", closePieMenu);
  pieMenu.appendChild(overlay);

  const container = document.createElement("div");
  container.className = "pie-container";
  container.style.left = centerX + "px";
  container.style.top = centerY + "px";
  pieMenu.appendChild(container);

  const actions = [];

  if (canEdit()) {
    actions.push({ icon: "👨", label: "إضافة أب", action: () => quickAddParent(personId, "father") });
    actions.push({ icon: "👩", label: "إضافة أم", action: () => quickAddParent(personId, "mother") });
    actions.push({ icon: "👶", label: "إضافة ابن", action: () => quickAddChild(personId) });
    actions.push({ icon: "💍", label: "زوج/زوجة", action: () => quickAddSpouse(personId) });
    actions.push({ icon: "✏️", label: "تعديل", action: () => openPersonModal(personId) });
  }

  if (isOwner()) {
    actions.push({ icon: "🗑️", label: "حذف", action: () => deletePersonFromCard(personId) });
  }

  if (actions.length === 0) {
    showToast("👁️ أنت مشاهد فقط", "info");
    return;
  }

  const count = actions.length;
  const startAngle = -Math.PI;
  const endAngle = 0;
  const angleStep = count > 1 ? (endAngle - startAngle) / (count - 1) : 0;
  const radius = 105;

  actions.forEach((act, i) => {
    const angle = startAngle + (angleStep * i);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    const btn = document.createElement("button");
    btn.className = "pie-item";
    btn.style.left = x + "px";
    btn.style.top = y + "px";

    const iconSpan = document.createElement("span");
    iconSpan.className = "pie-item-icon";
    iconSpan.textContent = act.icon;
    btn.appendChild(iconSpan);

    const labelSpan = document.createElement("span");
    labelSpan.className = "pie-item-label";
    labelSpan.textContent = act.label;
    btn.appendChild(labelSpan);

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      closePieMenu();
      setTimeout(() => act.action(), 150);
    });

    container.appendChild(btn);
  });

  const centerBtn = document.createElement("button");
  centerBtn.className = "pie-center";
  centerBtn.textContent = "✕";
  centerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closePieMenu();
  });
  container.appendChild(centerBtn);

  document.body.appendChild(pieMenu);
  setTimeout(() => pieMenu.classList.add("active"), 10);
}

function closePieMenu() {
  const existing = document.getElementById("pieMenu");
  if (existing) {
    existing.classList.remove("active");
    setTimeout(() => existing.remove(), 250);
  }
}


// ===== 40. الإضافة السريعة =====
async function quickAddParent(personId, type) {
  const name = prompt(`اسم ال${type === "father" ? "أب" : "أم"}:`);
  if (!name || !name.trim()) return;

  const newId = await addPerson({
    name: name.trim(),
    gender: type === "father" ? "male" : "female"
  });

  if (newId) {
    const updates = {};
    if (type === "father") updates.fatherId = newId;
    else updates.motherId = newId;
    await updatePerson(personId, updates);
  }
}

async function quickAddChild(parentId) {
  const name = prompt("اسم الابن/الابنة:");
  if (!name || !name.trim()) return;

  const parent = getPersonById(parentId);
  if (!parent) return;

  const gender = confirm("هل هو ذكر؟ (موافق = ذكر، إلغاء = أنثى)") ? "male" : "female";

  await addPerson({
    name: name.trim(),
    gender: gender,
    fatherId: parent.gender === "male" ? parentId : null,
    motherId: parent.gender === "female" ? parentId : null
  });
}

async function quickAddSpouse(personId) {
  const name = prompt("اسم الزوج/الزوجة:");
  if (!name || !name.trim()) return;

  const person = getPersonById(personId);
  if (!person) return;

  const spouseGender = person.gender === "male" ? "female" : "male";
  const spouseId = await addPerson({ name: name.trim(), gender: spouseGender });

  if (spouseId) {
    const husbandId = person.gender === "male" ? personId : spouseId;
    const wifeId = person.gender === "female" ? personId : spouseId;
    await addUnion(husbandId, wifeId);
  }
}

async function deletePersonFromCard(personId) {
  const person = getPersonById(personId);
  if (!person) return;

  if (confirm(`هل أنت متأكد من حذف "${person.name}"؟`)) {
    await deletePerson(personId);
  }
}


// ===== 41. حساب القرابة =====
function getRelationToRoot(personId) {
  const roots = findRootPersons();
  if (roots.length === 0) return "";

  let shortestPath = null;
  roots.forEach(root => {
    const path = findPath(root.id, personId);
    if (path && (!shortestPath || path.length < shortestPath.length)) {
      shortestPath = path;
    }
  });

  if (!shortestPath || shortestPath.length < 2) return "";
  return `قريب (${shortestPath.length - 1} خطوات)`;
}
function describeRelation(path) {
  const len = path.length - 1;
  if (len === 1) return "قريب مباشر";

  const target = getPersonById(path[path.length - 1]);
  const isFemale = target && target.gender === "female";

  const steps = [];
  for (let i = 0; i < len; i++) {
    const from = getPersonById(path[i]);
    const to = getPersonById(path[i + 1]);
    if (!from || !to) continue;

    if (from.fatherId === to.id || from.motherId === to.id) {
      steps.push("up");
    } else if (to.fatherId === from.id || to.motherId === from.id) {
      steps.push("down");
    } else if (state.unions.some(u => 
      (u.husbandId === from.id && u.wifeId === to.id) || 
      (u.wifeId === from.id && u.husbandId === to.id)
    )) {
      steps.push("spouse");
    } else {
      steps.push("relative");
    }
  }

  const ups = steps.filter(s => s === "up").length;
  const downs = steps.filter(s => s === "down").length;
  const spouses = steps.filter(s => s === "spouse").length;

  if (spouses > 0) return "قريب بالزواج";
  if (ups === 1 && downs === 0) return isFemale ? "أم" : "أب";
  if (ups === 2 && downs === 0) return isFemale ? "جدة" : "جد";
  if (ups === 3 && downs === 0) return isFemale ? "جدة عليا" : "جد أعلى";
  if (downs === 1 && ups === 0) return isFemale ? "ابنة" : "ابن";
  if (downs === 2 && ups === 0) return isFemale ? "حفيدة" : "حفيد";
  if (downs === 3 && ups === 0) return isFemale ? "حفيدة عليا" : "حفيد أعلى";
  if (ups === 1 && downs === 1) return isFemale ? "أخت" : "أخ";
  if (ups === 2 && downs === 1) return isFemale ? "عمة أو خالة" : "عم أو خال";
  if (ups === 1 && downs === 2) return isFemale ? "ابنة أخ/أخت" : "ابن أخ/أخت";
  if (ups === 2 && downs === 2) return isFemale ? "ابنة عم/عمة أو خال/خالة" : "ابن عم/عمة أو خال/خالة";
  return `قريب (${len} خطوات)`;
}


function findPath(startId, endId) {
  if (startId === endId) return [startId];
  const queue = [[startId]];
  const visited = new Set([startId]);

  while (queue.length > 0) {
    const path = queue.shift();
    const currentId = path[path.length - 1];
    const neighbors = getNeighbors(currentId);

    for (const neighborId of neighbors) {
      if (visited.has(neighborId)) continue;
      const newPath = [...path, neighborId];
      if (neighborId === endId) return newPath;
      visited.add(neighborId);
      queue.push(newPath);
    }
  }
  return null;
}

function getNeighbors(personId) {
  const neighbors = new Set();
  const person = getPersonById(personId);
  if (!person) return [];

  if (person.fatherId) neighbors.add(person.fatherId);
  if (person.motherId) neighbors.add(person.motherId);

  state.persons.forEach(p => {
    if (p.fatherId === personId || p.motherId === personId) neighbors.add(p.id);
  });

  state.parentChild.forEach(rel => {
    if (rel.parentId === personId) neighbors.add(rel.childId);
    if (rel.childId === personId) neighbors.add(rel.parentId);
  });

  state.unions.forEach(union => {
    if (union.husbandId === personId) neighbors.add(union.wifeId);
    if (union.wifeId === personId) neighbors.add(union.husbandId);
  });

  return Array.from(neighbors);
}


// ===== 42. PIN =====
function showPinModal(description, callback) {
  const descEl = document.getElementById("pinDescription");
  if (descEl) descEl.textContent = description;

  const input = document.getElementById("inputPin");
  if (input) input.value = "";

  show("pinModal");

  const confirmBtn = document.getElementById("btnConfirmPin");
  const cancelBtn = document.getElementById("btnCancelPin");

  const newConfirm = confirmBtn.cloneNode(true);
  const newCancel = cancelBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
  cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

  newConfirm.addEventListener("click", () => {
    const pin = input.value.trim();
    if (pin.length < 4) {
      showToast("❌ PIN قصير", "error");
      return;
    }
    callback(pin);
  });

  newCancel.addEventListener("click", () => hide("pinModal"));
}

function setPin() {
  showPinModal("أدخل PIN جديد", (pin) => {
    storage.set(STORAGE_KEYS.PIN, pin);
    state.pin = pin;
    hide("pinModal");
    showToast("✅ تم تعيين PIN", "success");
    updatePinButtons();
  });
}

function removePin() {
  if (confirm("هل تريد إزالة PIN؟")) {
    storage.remove(STORAGE_KEYS.PIN);
    state.pin = null;
    showToast("✅ تم الإزالة", "success");
    updatePinButtons();
  }
}

function updatePinButtons() {
  const btnSet = document.getElementById("btnSetPin");
  const btnRemove = document.getElementById("btnRemovePin");

  if (state.pin) {
    if (btnSet) btnSet.classList.add("hidden");
    if (btnRemove) btnRemove.classList.remove("hidden");
  } else {
    if (btnSet) btnSet.classList.remove("hidden");
    if (btnRemove) btnRemove.classList.add("hidden");
  }
}

console.log("✅ الجزء 5 محمّل");
/* ============================================
   الجزء 6 (الأخير): النوافذ + الإعدادات + ربط الأحداث
   ============================================ */

// ===== 43. نافذة إضافة/تعديل فرد =====
function openPersonModal(personId = null) {
  state.editingPersonId = personId;

  const titleEl = document.getElementById("personModalTitle");
  const nameInput = document.getElementById("inputPersonName");
  const titleInput = document.getElementById("inputPersonTitle");
  const genderInput = document.getElementById("selectGender");
  const fatherInput = document.getElementById("selectFather");
  const motherInput = document.getElementById("selectMother");
  const birthInput = document.getElementById("inputBirthYear");
  const relationInput = document.getElementById("selectRelationType");
  const notesInput = document.getElementById("inputNotes");
  const isAliveInput = document.getElementById("selectIsAlive");
  const deathYearInput = document.getElementById("inputDeathYear");
  const deathGroup = document.getElementById("deathYearGroup");

  fillParentSelects();

  if (personId) {
    const person = getPersonById(personId);
    if (!person) return;

    titleEl.textContent = "تعديل فرد";
    nameInput.value = person.name || "";
    if (titleInput) titleInput.value = person.title || "";
    genderInput.value = person.gender || "male";
    fatherInput.value = person.fatherId || "";
    motherInput.value = person.motherId || "";
    birthInput.value = person.birthYear || "";
    relationInput.value = person.relationType || "biological";
    notesInput.value = person.notes || "";
    if (isAliveInput) isAliveInput.value = person.isAlive || "alive";
    if (person.isAlive === "deceased") {
      if (deathGroup) deathGroup.classList.remove("hidden");
      if (deathYearInput) deathYearInput.value = person.deathYear || "";
    } else {
      if (deathGroup) deathGroup.classList.add("hidden");
      if (deathYearInput) deathYearInput.value = "";
    }
  } else {
    titleEl.textContent = "إضافة فرد";
    nameInput.value = "";
    genderInput.value = "male";
    fatherInput.value = "";
    motherInput.value = "";
    birthInput.value = "";
    relationInput.value = "biological";
    notesInput.value = "";
    if (isAliveInput) isAliveInput.value = "alive";
    if (deathGroup) deathGroup.classList.add("hidden");
    if (deathYearInput) deathYearInput.value = "";
  }

  show("personModal");
  setTimeout(() => nameInput.focus(), 300);
}


function fillParentSelects() {
  const fatherSelect = document.getElementById("selectFather");
  const motherSelect = document.getElementById("selectMother");
  if (!fatherSelect || !motherSelect) return;

  const males = sortPersonsByName(state.persons.filter(p => p.gender === "male" && p.id !== state.editingPersonId));
  const females = sortPersonsByName(state.persons.filter(p => p.gender === "female" && p.id !== state.editingPersonId));

  fatherSelect.innerHTML = '<option value="">— لا يوجد —</option>' +
    males.map(p => {
      const fatherName = p.fatherId ? getPersonName(p.fatherId) : null;
      const label = fatherName ? `${escapeHtml(p.name)} (${escapeHtml(fatherName)})` : escapeHtml(p.name);
      return `<option value="${p.id}">${label}</option>`;
    }).join("");

  motherSelect.innerHTML = '<option value="">— لا يوجد —</option>' +
    females.map(p => {
      const fatherName = p.fatherId ? getPersonName(p.fatherId) : null;
      const label = fatherName ? `${escapeHtml(p.name)} (${escapeHtml(fatherName)})` : escapeHtml(p.name);
      return `<option value="${p.id}">${label}</option>`;
    }).join("");
}


async function savePersonFromModal() {
  const nameInput = document.getElementById("inputPersonName");
  const name = nameInput ? nameInput.value.trim() : "";

  if (!name) {
    showToast("❌ الاسم مطلوب", "error");
    nameInput.focus();
    return;
  }

  const isAliveEl = document.getElementById("selectIsAlive");
  const deathYearEl = document.getElementById("inputDeathYear");

  const data = {
    name: name,
    gender: document.getElementById("selectGender").value,
    title: document.getElementById("inputPersonTitle") ? document.getElementById("inputPersonTitle").value.trim() : "",
    fatherId: document.getElementById("selectFather").value || null,
    motherId: document.getElementById("selectMother").value || null,
    birthYear: parseInt(document.getElementById("inputBirthYear").value) || null,
    relationType: document.getElementById("selectRelationType").value,
    notes: document.getElementById("inputNotes").value.trim(),
    isAlive: isAliveEl ? isAliveEl.value : "alive",
    deathYear: (isAliveEl && isAliveEl.value === "deceased" && deathYearEl)
      ? (parseInt(deathYearEl.value) || null)
      : null
  };

  try {
    if (state.editingPersonId) {
      await updatePerson(state.editingPersonId, data);
    } else {
      const newId = await addPerson(data);
      if (newId) {
        if (data.fatherId) await addParentChildRelation(data.fatherId, newId, data.relationType);
        if (data.motherId) await addParentChildRelation(data.motherId, newId, data.relationType);
      }
    }
  } catch (error) {
    console.error("خطأ:", error);
  } finally {
    hide("personModal");
    state.editingPersonId = null;
  }
}


// ===== 44. نافذة إضافة علاقة =====
function openRelationModal(personId) {
  state.relationFromPersonId = personId;
  const person = getPersonById(personId);
  if (!person) return;

  const body = document.getElementById("relationModalBody");
  const title = document.getElementById("relationModalTitle");
  title.textContent = `إضافة علاقة لـ ${person.name}`;

  body.innerHTML = `
    <div class="form-group">
      <label>نوع العلاقة</label>
      <select id="selectRelationKind">
        <option value="spouse">💍 زوج/زوجة</option>
        <option value="child">👶 ابن/ابنة</option>
        <option value="parent">👨 أب/أم</option>
      </select>
    </div>
    <div class="form-group">
      <label>الفرد المرتبط</label>
      <select id="selectRelationTarget">
        <option value="">— اختر —</option>
      </select>
    </div>
    <div class="form-group">
      <label>نوع العلاقة (للأبناء)</label>
      <select id="selectRelationSubType">
        <option value="biological">طبيعي</option>
        <option value="adopted">تبنّي</option>
        <option value="fostered">كفالة</option>
      </select>
    </div>
    <div class="form-group" id="unionStatusGroup" style="display:none;">
      <label>حالة الزواج</label>
      <select id="selectUnionStatus">
        <option value="married">متزوج</option>
        <option value="divorced">مطلق</option>
        <option value="widowed">متوفى</option>
      </select>
    </div>
  `;

  const kindSelect = document.getElementById("selectRelationKind");
  const statusGroup = document.getElementById("unionStatusGroup");

  kindSelect.addEventListener("change", () => {
    const kind = kindSelect.value;
    statusGroup.style.display = kind === "spouse" ? "block" : "none";
    fillRelationTargets(kind);
  });

  fillRelationTargets("spouse");
  show("relationModal");
}


function fillRelationTargets(kind) {
  const targetSelect = document.getElementById("selectRelationTarget");
  if (!targetSelect) return;

  let candidates = [];
  const person = getPersonById(state.relationFromPersonId);
  if (!person) return;

  if (kind === "spouse") {
    candidates = state.persons.filter(p =>
      p.id !== state.relationFromPersonId &&
      p.gender !== person.gender &&
      !getSpouses(state.relationFromPersonId).some(s => s.id === p.id)
    );
  } else if (kind === "child") {
    candidates = state.persons.filter(p =>
      p.id !== state.relationFromPersonId &&
      p.fatherId !== state.relationFromPersonId &&
      p.motherId !== state.relationFromPersonId
    );
  } else if (kind === "parent") {
    candidates = state.persons.filter(p =>
      p.id !== state.relationFromPersonId &&
      p.id !== person.fatherId &&
      p.id !== person.motherId
    );
  }

  candidates = sortPersonsByName(candidates);
  targetSelect.innerHTML = '<option value="">— اختر —</option>' +
    candidates.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (${p.gender === "male" ? "ذكر" : "أنثى"})</option>`).join("");
}


async function saveRelationFromModal() {
  const kind = document.getElementById("selectRelationKind").value;
  const targetId = document.getElementById("selectRelationTarget").value;
  const subType = document.getElementById("selectRelationSubType").value;
  const unionStatus = document.getElementById("selectUnionStatus").value;

  if (!targetId) {
    showToast("❌ اختر الفرد", "error");
    return;
  }

  const person = getPersonById(state.relationFromPersonId);
  const target = getPersonById(targetId);
  if (!person || !target) return;

  let success = false;

  if (kind === "spouse") {
    const husbandId = person.gender === "male" ? person.id : target.id;
    const wifeId = person.gender === "female" ? person.id : target.id;
    success = await addUnion(husbandId, wifeId, unionStatus);
  } else if (kind === "child") {
    if (person.gender === "male") {
      await updatePerson(targetId, { fatherId: person.id, relationType: subType });
      success = await addParentChildRelation(person.id, targetId, subType);
    } else {
      await updatePerson(targetId, { motherId: person.id, relationType: subType });
      success = await addParentChildRelation(person.id, targetId, subType);
    }
  } else if (kind === "parent") {
    if (target.gender === "male") {
      await updatePerson(person.id, { fatherId: target.id });
    } else {
      await updatePerson(person.id, { motherId: target.id });
    }
    success = await addParentChildRelation(target.id, person.id, subType);
  }

  if (success) {
    hide("relationModal");
    showToast("✅ تمت الإضافة", "success");
  }
}


// ===== 45. الإعدادات =====
function openSettings() {
  updateSettingsUI();
  updatePinButtons();
  show("settingsModal");
}

async function saveSettings() {
  try {
    const newName = document.getElementById("inputPlatformName").value.trim();
    if (!newName) {
      showToast("❌ اسم المنصة مطلوب", "error");
      return;
    }

    const editorCodeInput = document.getElementById("editorCodeInput");
    const viewerCodeInput = document.getElementById("viewerCodeInput");
    const newEditorCode = editorCodeInput ? editorCodeInput.value.trim().toUpperCase() : "";
    const newViewerCode = viewerCodeInput ? viewerCodeInput.value.trim().toUpperCase() : "";

    if (newEditorCode && newViewerCode && newEditorCode === newViewerCode) {
      showToast("❌ الكودان يجب أن يكونا مختلفين", "error");
      return;
    }

    const updates = { name: newName };
    if (newEditorCode) updates.editorCode = newEditorCode;
    if (newViewerCode) updates.viewerCode = newViewerCode;

    const metaRef = doc(db, COLLECTIONS.FAMILIES, state.familyId, COLLECTIONS.META, "info");
    await setDoc(metaRef, updates, { merge: true });

    const familyRef = doc(db, COLLECTIONS.FAMILIES, state.familyId);
    await setDoc(familyRef, updates, { merge: true });

    updatePlatformTitle(newName);
    hide("settingsModal");
    showToast("✅ تم الحفظ", "success");
  } catch (error) {
    console.error("خطأ:", error);
    showToast("❌ فشل الحفظ", "error");
  }
}


// ===== 46. الوضع الليلي والمضغوط =====
function toggleTheme() {
  state.isDark = !state.isDark;
  if (state.isDark) document.body.classList.add("dark");
  else document.body.classList.remove("dark");
  storage.set(STORAGE_KEYS.THEME, state.isDark);
  showToast(state.isDark ? "🌙 ليلي" : "☀️ نهاري", "info");
}

function toggleCompact() {
  state.isCompact = !state.isCompact;
  if (state.isCompact) document.body.classList.add("compact");
  else document.body.classList.remove("compact");
  storage.set(STORAGE_KEYS.COMPACT, state.isCompact);
  showToast(state.isCompact ? "📐 مضغوط" : "🔍 عادي", "info");
}


// ===== 47. النسخ الاحتياطي =====
async function exportJSON() {
  try {
    const data = {
      meta: state.familyMeta,
      persons: state.persons,
      unions: state.unions,
      parentChild: state.parentChild,
      exportedAt: new Date().toISOString(),
      version: "1.0.0"
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `family-tree-backup-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
    showToast("✅ تم التصدير", "success");
  } catch (error) {
    showToast("❌ فشل التصدير", "error");
  }
}

async function importJSON(file) {
  if (!isOwner()) {
    showToast("❌ للمالك فقط", "error");
    return;
  }

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.persons || !Array.isArray(data.persons)) {
      showToast("❌ ملف غير صالح", "error");
      return;
    }

    if (!confirm(`سيتم استيراد ${data.persons.length} فرد. متابعة؟`)) return;

    const batch1 = writeBatch(db);
    state.persons.forEach(p => batch1.delete(doc(db, COLLECTIONS.FAMILIES, state.familyId, COLLECTIONS.PERSONS, p.id)));
    state.unions.forEach(u => batch1.delete(doc(db, COLLECTIONS.FAMILIES, state.familyId, COLLECTIONS.UNIONS, u.id)));
    state.parentChild.forEach(r => batch1.delete(doc(db, COLLECTIONS.FAMILIES, state.familyId, COLLECTIONS.PARENT_CHILD, r.id)));
    await batch1.commit();

    const batch2 = writeBatch(db);
    data.persons.forEach(p => {
      const ref = doc(db, COLLECTIONS.FAMILIES, state.familyId, COLLECTIONS.PERSONS, p.id);
      batch2.set(ref, { ...p, updatedAt: serverTimestamp() });
    });
    (data.unions || []).forEach(u => {
      const ref = doc(db, COLLECTIONS.FAMILIES, state.familyId, COLLECTIONS.UNIONS, u.id);
      batch2.set(ref, u);
    });
    (data.parentChild || []).forEach(r => {
      const ref = doc(db, COLLECTIONS.FAMILIES, state.familyId, COLLECTIONS.PARENT_CHILD, r.id);
      batch2.set(ref, r);
    });
    await batch2.commit();

    showToast("✅ تم الاستيراد", "success");
  } catch (error) {
    showToast("❌ فشل الاستيراد", "error");
  }
}


// ===== 48. شريط الأزرار =====
function handleActionBarClick(action) {
  switch (action) {
    case "menu": show("sideDrawer"); break;
    case "tree": resetZoom(); switchActiveAction("tree"); break;
    case "persons": openPersonsList(); switchActiveAction("persons"); break;
    case "add":
      if (!canEdit()) { showToast("❌ ليس لديك صلاحية", "error"); return; }
      openPersonModal(null);
      switchActiveAction("add");
      break;
    case "pie": showToast("💡 اضغط مطولاً على أي فرد", "info"); break;
    case "settings": openSettings(); switchActiveAction("settings"); break;
    case "theme": toggleTheme(); break;
      case "relation":
  calculateRelationFlow();
  break;
  }
}

function switchActiveAction(actionName) {
  document.querySelectorAll(".action-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.action === actionName);
  });
}


function openPersonsList() {
  const sorted = sortPersonsByName(state.persons);
  const body = document.getElementById("bottomSheetBody");
  if (!body) return;

  if (sorted.length === 0) {
    body.innerHTML = `
      <div class="person-card">
        <p style="text-align:center; padding:20px;">لا يوجد أفراد</p>
        ${canEdit() ? `<button class="btn-primary" id="emptyAddBtn">➕ إضافة</button>` : ""}
      </div>
    `;
    const btn = document.getElementById("emptyAddBtn");
    if (btn) btn.addEventListener("click", () => { hide("bottomSheet"); openPersonModal(null); });
    show("bottomSheet");
    return;
  }

  body.innerHTML = `
    <div class="person-card">
      <h3 style="margin-bottom:15px;">👥 الأفراد (${sorted.length})</h3>
      <div style="display:flex; flex-direction:column; gap:8px; max-height:60vh; overflow-y:auto;" id="personsListContainer"></div>
    </div>
  `;

  const container = document.getElementById("personsListContainer");
  sorted.forEach(p => {
    const btn = document.createElement("button");
    btn.className = "drawer-item";
    btn.style.width = "100%";
    btn.innerHTML = `<span class="drawer-icon">${p.gender === "female" ? "👩" : "👨"}</span><span>${escapeHtml(p.name)}</span>`;
    btn.addEventListener("click", () => { hide("bottomSheet"); setTimeout(() => openPersonCard(p.id), 200); });
    container.appendChild(btn);
  });

  show("bottomSheet");
}


// ===== 49. القائمة الجانبية =====
function handleDrawerNav(nav) {
  setTimeout(() => updateDrawerUserInfo(), 100);  // ← أضف هذا السطر
  hide("sideDrawer");
  setTimeout(() => {
    switch (nav) {
      case "tree": resetZoom(); switchActiveAction("tree"); break;
      case "persons": openPersonsList(); break;
      case "add":
        if (!canEdit()) { showToast("❌ ليس لديك صلاحية", "error"); return; }
        openPersonModal(null);
        break;
      case "history": loadHistory(); show("historyModal"); break;
      case "settings": openSettings(); break;
      case "logout":
        if (confirm("هل تريد تسجيل الخروج؟")) handleLogout();
        break;
    }
    }, 200);
}


// ===== 50. ربط الأحداث =====
document.addEventListener("DOMContentLoaded", () => {
  console.log("🔗 ربط الأحداث...");

  const btnGoogle = document.getElementById("btnGoogleLogin");
  if (btnGoogle) btnGoogle.addEventListener("click", handleGoogleLogin);

  const btnJoin = document.getElementById("btnJoinByCode");
  if (btnJoin) btnJoin.addEventListener("click", openJoinModal);

  const btnConfirmJoin = document.getElementById("btnConfirmJoin");
  if (btnConfirmJoin) btnConfirmJoin.addEventListener("click", confirmJoin);

  const btnCancelJoin = document.getElementById("btnCancelJoin");
  if (btnCancelJoin) btnCancelJoin.addEventListener("click", () => hide("joinModal"));

  const btnCloseJoin = document.getElementById("btnCloseJoinModal");
  if (btnCloseJoin) btnCloseJoin.addEventListener("click", () => hide("joinModal"));

  document.querySelectorAll(".action-btn").forEach(btn => {
    btn.addEventListener("click", () => handleActionBarClick(btn.dataset.action));
  });

  document.querySelectorAll(".drawer-item").forEach(item => {
    item.addEventListener("click", () => handleDrawerNav(item.dataset.nav));
  });

  const fab = document.getElementById("fabMenu");
  if (fab) fab.addEventListener("click", () => showActionBar());

  const btnSaveSettings = document.getElementById("btnSaveSettings");
  if (btnSaveSettings) btnSaveSettings.addEventListener("click", saveSettings);

  const btnSetPin = document.getElementById("btnSetPin");
  if (btnSetPin) btnSetPin.addEventListener("click", setPin);

  const btnRemovePin = document.getElementById("btnRemovePin");
  if (btnRemovePin) btnRemovePin.addEventListener("click", removePin);

  const btnToggleTheme = document.getElementById("btnToggleTheme");
  if (btnToggleTheme) btnToggleTheme.addEventListener("click", toggleTheme);

  const btnToggleCompact = document.getElementById("btnToggleCompact");
  if (btnToggleCompact) btnToggleCompact.addEventListener("click", toggleCompact);

  const btnExport = document.getElementById("btnExportJSON");
  if (btnExport) btnExport.addEventListener("click", exportJSON);

  const btnImport = document.getElementById("btnImportJSON");
  const inputImport = document.getElementById("inputImportJSON");
  if (btnImport && inputImport) {
    btnImport.addEventListener("click", () => inputImport.click());
    inputImport.addEventListener("change", (e) => {
      if (e.target.files[0]) importJSON(e.target.files[0]);
    });
  }

  const btnSavePerson = document.getElementById("btnSavePerson");
  if (btnSavePerson) btnSavePerson.addEventListener("click", savePersonFromModal);

  const btnCancelPerson = document.getElementById("btnCancelPerson");
  if (btnCancelPerson) btnCancelPerson.addEventListener("click", () => {
    hide("personModal");
    state.editingPersonId = null;
  });

  const btnSaveRelation = document.getElementById("btnSaveRelation");
  if (btnSaveRelation) btnSaveRelation.addEventListener("click", saveRelationFromModal);

  const btnCancelRelation = document.getElementById("btnCancelRelation");
  if (btnCancelRelation) btnCancelRelation.addEventListener("click", () => hide("relationModal"));

  const btnAddFirst = document.getElementById("btnAddFirst");
  if (btnAddFirst) btnAddFirst.addEventListener("click", () => openPersonModal(null));

  document.addEventListener("change", (e) => {
    if (e.target && e.target.id === "selectIsAlive") {
      const deathGroup = document.getElementById("deathYearGroup");
      if (deathGroup) {
        if (e.target.value === "deceased") deathGroup.classList.remove("hidden");
        else deathGroup.classList.add("hidden");
      }
    }
  });

  // أزرار الإغلاق
  const closeMap = {
    "btnCloseSettings": "settingsModal",
    "btnClosePersonModal": "personModal",
    "btnCloseRelationModal": "relationModal",
    "btnClosePinModal": "pinModal",
    "btnCloseHistory": "historyModal",
    "btnCloseDrawer": "sideDrawer"
  };
  Object.entries(closeMap).forEach(([btnId, modalId]) => {
    const btn = document.getElementById(btnId);
    if (btn) btn.addEventListener("click", () => hide(modalId));
  });

  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      const modal = e.target.closest(".modal");
      if (modal) hide(modal.id);
    });
  });

  document.querySelectorAll(".bottom-sheet-overlay, .drawer-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      const parent = e.target.closest(".bottom-sheet, .side-drawer");
      if (parent) hide(parent.id);
    });
  });

  // نسخ الأكواد
  const btnCopyEditor = document.getElementById("btnCopyEditorCode");
  if (btnCopyEditor) {
    btnCopyEditor.addEventListener("click", () => {
      const code = document.getElementById("editorCodeInput").value;
      if (code) navigator.clipboard.writeText(code).then(() => showToast("✅ تم النسخ", "success"));
    });
  }

  const btnCopyViewer = document.getElementById("btnCopyViewerCode");
  if (btnCopyViewer) {
    btnCopyViewer.addEventListener("click", () => {
      const code = document.getElementById("viewerCodeInput").value;
      if (code) navigator.clipboard.writeText(code).then(() => showToast("✅ تم النسخ", "success"));
    });
  }

  setTimeout(() => initZoomPan(), 500);

  console.log("✅ تم ربط الأحداث");
});


// ===== 51. تصدير للاستخدام العام =====
window.FT = {
  state, showToast, show, hide, storage,
  generateId, generateInviteCode,
  getPersonById, getPersonName, canEdit, isOwner,
  ROLES, RELATION_TYPES, COLLECTIONS, STORAGE_KEYS,
  openPieMenu, closePieMenu, openPersonCard,
  openPersonModal, openRelationModal, openSettings, openPersonsList
};


console.log("✅✅✅ تم تحميل app.js بالكامل بنجاح! ✅✅✅");

/* ============================================
   عرض معلومات المستخدم في القائمة الجانبية
   ============================================ */
function updateDrawerUserInfo() {
  const avatarEl = document.getElementById("drawerUserAvatar");
  const nameEl = document.getElementById("drawerUserName");
  const roleEl = document.getElementById("drawerUserRole");

  if (!state.user) return;

  const displayName = state.user.displayName || state.user.email || "مستخدم";
  const initials = displayName.charAt(0).toUpperCase();

  if (avatarEl) avatarEl.textContent = initials;
  if (nameEl) nameEl.textContent = displayName;

  if (roleEl) {
    const roleNames = { "owner": "👑 مالك", "editor": "✏️ محرر", "viewer": "👁️ مشاهد" };
    roleEl.textContent = roleNames[state.role] || "—";
  }
}
/* ============================================
   حساب العلاقة بين شخصين
   ============================================ */

function getRelationBetween(startId, endId) {
  const path = findPath(startId, endId);
  if (!path || path.length < 2) return null;

  const start = getPersonById(startId);
  const end = getPersonById(endId);
  if (!start || !end) return null;

  const relation = describeRelationBetween(path, start, end);
  return `${end.name} ${relation} ${start.name}`;
}

function describeRelationBetween(path, startPerson, endPerson) {
  const len = path.length - 1;
  const isEndFemale = endPerson.gender === "female";

  const steps = [];
  for (let i = 0; i < len; i++) {
    const from = getPersonById(path[i]);
    const to = getPersonById(path[i + 1]);
    if (!from || !to) continue;

    if (from.fatherId === to.id || from.motherId === to.id) {
      steps.push("up");
    } else if (to.fatherId === from.id || to.motherId === from.id) {
      steps.push("down");
    } else if (state.unions.some(u => 
      (u.husbandId === from.id && u.wifeId === to.id) || 
      (u.wifeId === from.id && u.husbandId === to.id)
    )) {
      steps.push("spouse");
    } else {
      steps.push("relative");
    }
  }

  const ups = steps.filter(s => s === "up").length;
  const downs = steps.filter(s => s === "down").length;
  const spouses = steps.filter(s => s === "spouse").length;

  if (spouses > 0) return "قريب بالزواج";

  // الأبناء
  if (downs === 1 && ups === 0) {
    if (endPerson.fatherId === startPerson.id || endPerson.motherId === startPerson.id) {
      return isEndFemale ? "ابنة" : "ابن";
    }
    return isEndFemale ? "ابنة أخ/أخت" : "ابن أخ/أخت";
  }

  // الأحفاد
  if (downs === 2 && ups === 0) return isEndFemale ? "حفيدة" : "حفيد";
  if (downs === 3 && ups === 0) return isEndFemale ? "حفيدة عليا" : "حفيد أعلى";

  // الآباء والأمهات
  if (ups === 1 && downs === 0) {
    if (startPerson.fatherId === endPerson.id) return "أب";
    if (startPerson.motherId === endPerson.id) return "أم";

    // أخ/أخت الوالد
    const parentId = startPerson.fatherId || startPerson.motherId;
    const parent = getPersonById(parentId);
    if (parent) {
      const isSibling = state.persons.some(p => 
        p.id === endPerson.id && 
        ((p.fatherId && p.fatherId === parent.fatherId) || 
         (p.motherId && p.motherId === parent.motherId))
      );
      if (isSibling) {
        if (parent.gender === "male") return isEndFemale ? "عمة" : "عم";
        return isEndFemale ? "خالة" : "خال";
      }
    }
    return isEndFemale ? "عمة أو خالة" : "عم أو خال";
  }

  // الأجداد
  if (ups === 2 && downs === 0) {
    return isEndFemale ? "جدة" : "جد";
  }
  if (ups === 3 && downs === 0) {
    return isEndFemale ? "جدة عليا" : "جد أعلى";
  }
  if (ups >= 4 && downs === 0) {
    return isEndFemale ? "جدة عليا" : "جد أعلى";
  }

  // نفس الجيل
  if (ups === 1 && downs === 1) {
    if ((startPerson.fatherId && startPerson.fatherId === endPerson.fatherId) ||
        (startPerson.motherId && startPerson.motherId === endPerson.motherId)) {
      return isEndFemale ? "أخت" : "أخ";
    }
    return isEndFemale ? "أخت غير شقيقة" : "أخ غير شقيق";
  }

  // أبناء العم/الخال
  if (ups === 2 && downs === 2) {
    return isEndFemale ? "ابنة عم أو خال" : "ابن عم أو خال";
  }

  // أعمام/أخوال الأجداد → جدة/جد
  if (ups === 3 && downs === 1) {
    return isEndFemale ? "جدة" : "جد";
  }
  if (ups === 3 && downs === 2) {
    return isEndFemale ? "جدة" : "جد";
  }

  // أبناء الأحفاد
  if (ups === 1 && downs === 2) return isEndFemale ? "ابنة حفيد" : "ابن حفيد";
  if (ups === 1 && downs === 3) return isEndFemale ? "ابنة حفيد أعلى" : "ابن حفيد أعلى";

  return `قريب (${len} خطوات)`;
}
/* ============================================
   حساب مستوى الشخص (طابقه)
   ============================================ */
function getPersonLevel(personId) {
  const roots = findRootPersons();
  if (roots.length === 0) return 0;

  let minLevel = Infinity;
  roots.forEach(root => {
    const path = findPath(root.id, personId);
    if (path && path.length < minLevel) {
      minLevel = path.length;
    }
  });

  return minLevel === Infinity ? 0 : minLevel;
}
/* ============================================
   حساب القرابة بين شخصين
   ============================================ */

let relationState = {
  firstPerson: null,
  secondPerson: null
};

function calculateRelationFlow() {
  relationState.firstPerson = null;
  relationState.secondPerson = null;

  showToast("👆 اختر الشخص الأول", "info");
  state.selectedPersonId = null;
  state.relationMode = true;

    renderTree();
}
  
function handleRelationClick(personId) {
  if (!state.relationMode) return false;

  if (!relationState.firstPerson) {
    relationState.firstPerson = personId;
    const p1 = getPersonById(personId);
    showToast(`✅ الأول: ${p1.name}\n👆 اختر الشخص الثاني`, "info");
    return true;
  }

  if (relationState.firstPerson === personId) {
    showToast("⚠️ اختر شخصاً آخر", "warning");
    return true;
  }

  relationState.secondPerson = personId;
  const p1 = getPersonById(relationState.firstPerson);
  const p2 = getPersonById(relationState.secondPerson);

  const level1 = getPersonLevel(relationState.firstPerson);
  const level2 = getPersonLevel(relationState.secondPerson);
  const diff = level2 - level1;

  const isP2Female = p2.gender === "female";
  let relation = "";

  if (diff === 0) {
    relation = isP2Female ? "أخت" : "أخ";
  } else if (diff === 1) {
    relation = isP2Female ? "عمة أو خالة" : "عم أو خال";
  } else if (diff === 2) {
    relation = isP2Female ? "جدة" : "جد";
  } else if (diff >= 3) {
    relation = isP2Female ? "جدة عليا" : "جد أعلى";
  } else if (diff === -1) {
    relation = isP2Female ? "ابنة أخ/أخت" : "ابن أخ/أخت";
  } else if (diff === -2) {
    relation = isP2Female ? "حفيدة" : "حفيد";
  } else if (diff <= -3) {
    relation = isP2Female ? "حفيدة عليا" : "حفيد أعلى";
  }

  const relationText = `${p2.name} ${relation} ${p1.name}`;

  const modal = document.getElementById("relationResultModal");
  const el1 = document.getElementById("relationPerson1");
  const el2 = document.getElementById("relationPerson2");
  const elText = document.getElementById("relationText");

  if (el1) el1.textContent = p1.name;
  if (el2) el2.textContent = p2.name;
  if (elText) elText.textContent = relationText;
  if (modal) modal.style.display = "flex";

  const btnClose = document.getElementById("btnCloseRelationResult");
  if (btnClose) {
    btnClose.onclick = function() { modal.style.display = "none"; };
  }

  state.relationMode = false;
  state.selectedPersonId = null;
  relationState.firstPerson = null;
  relationState.secondPerson = null;
  renderTree();

  return true;
}
/* =======================================
   التركيز على شخص (Zoom + Center)
   ============================================ */
function focusOnPerson(personId) {
  const node = document.querySelector(`.tree-node[data-person-id="${personId}"]`);
  if (!node) return;

  const container = document.getElementById("treeContainer");
  if (!container) return;

  const containerRect = container.getBoundingClientRect();
  const nodeRect = node.getBoundingClientRect();

  // الموضع الحالي للشجرة
  const currentZoom = state.zoom;
  const targetZoom = 1.5;

  // مركز العقدة في الشجرة (قبل التحويل)
  const nodeCenterX = node.offsetLeft + node.offsetWidth / 2;
  const nodeCenterY = node.offsetTop + node.offsetHeight / 2;

  // مركز الحاوية
  const containerCenterX = containerRect.width / 2;
  const containerCenterY = containerRect.height / 2;

  // حساب panX و panY
  state.zoom = targetZoom;
  state.panX = containerCenterX - nodeCenterX * targetZoom;
  state.panY = containerCenterY - nodeCenterY * targetZoom;

  applyTransform();
}