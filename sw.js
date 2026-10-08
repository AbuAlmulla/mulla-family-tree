/* ============================================
   Service Worker - تطبيق شجرة العائلة
   الجزء 4ب: التخزين المؤقت للعمل بدون إنترنت
   ============================================ */

const CACHE_NAME = 'mulla-family-tree-v1.0.0';

// الملفات التي سيتم تخزينها مؤقتاً
const CACHE_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

// 1. التثبيت: تخزين الملفات الأساسية
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: جارٍ التثبيت...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 جارٍ تخزين الملفات...');
      return cache.addAll(CACHE_FILES).catch((err) => {
        console.warn('⚠️ بعض الملفات لم تُخزن:', err);
      });
    })
  );
  self.skipWaiting();
});

// 2. التنشيط: حذف الإصدارات القديمة
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker: جارٍ التنشيط...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ حذف ذاكرة قديمة:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. الجلب: استراتيجية Cache First مع تحديث في الخلفية
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // تجاهل الطلبات غير GET
  if (request.method !== 'GET') return;

  // تجاهل طلبات Firebase و Google Fonts (تُجلب من الشبكة مباشرة)
  const url = new URL(request.url);
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('firebaseio')
  ) {
    return;
  }

  // استراتيجية: Cache First, ثم Network, ثم Cache
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // تحديث في الخلفية (Stale-while-revalidate)
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, networkResponse.clone());
            });
          }
        }).catch(() => {});
        
        return cachedResponse;
      }

      // غير موجود في الكاش → جلبه من الشبكة
      return fetch(request).then((networkResponse) => {
        // تخزين الملفات الجديدة
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // في حال فشل الاتصال، أرجع صفحة index.html كـ fallback
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// 4. استقبال رسائل من التطبيق
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('✅ Service Worker: تم التحميل');