export function exportShoppingDoc(items: string[]) {
  if (!items.length) {
    return null;
  }

  const createdAt = new Date().toISOString();

  const formattedDate = new Intl.DateTimeFormat("he-IL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(createdAt));

  const html = `
    <html dir="rtl">
      <head>
        <meta charset="utf-8" />

        <style>
          body {
            font-family: Arial, sans-serif;
            direction: rtl;
            padding: 40px;
            background: white;
            color: #111827;
          }

          h1 {
            font-size: 30px;
            margin-bottom: 6px;
          }

          .date {
            color: #6b7280;
            margin-bottom: 24px;
          }

          .divider {
            border-top: 2px solid #e5e7eb;
            margin: 24px 0;
          }

          .item {
            font-size: 18px;
            padding: 12px 0;
            border-bottom: 1px solid #f3f4f6;
          }

          .checkbox {
            margin-left: 12px;
          }
        </style>
      </head>

      <body>
        <h1>🛒 רשימת קניות</h1>

        <div class="date">
          נוצר בתאריך: ${formattedDate}
        </div>

        <div class="divider"></div>

        ${items
          .map(
            (item) => `
              <div class="item">
                <span class="checkbox">☐</span>
                ${item}
              </div>
            `
          )
          .join("")}
      </body>
    </html>
  `;

  const blob = new Blob([html], {
    type: "application/msword;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = `shopping-list-${createdAt.slice(0, 10)}.doc`;
  link.click();

  URL.revokeObjectURL(url);

  return createdAt;
}
