// NRG push service worker. Receives push events, renders a notification,
// focuses or opens the relevant tab when clicked.
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'NRG', body: event.data.text() };
  }
  const { title = 'NRG', body = '', url = '/', tag, icon } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: icon || '/icon-192.png',
      badge: '/icon-192.png',
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(new URL(targetUrl, self.location.origin).pathname) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});
