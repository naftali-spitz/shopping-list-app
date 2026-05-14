export function exportShoppingDoc(items: string[]) {
  if (!items.length) {
    return null;
  }

  const createdAt = new Date().toISOString();

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
      </head>

      <body
        style="
          font-family: Arial;
          padding: 32px;
          background: #050816;
          color: white;
        "
      >
        <h1>FutureCart Shopping List</h1>

        <p>${new Date(createdAt).toLocaleString()}</p>

        <ul>
          ${items
            .map(
              (item) =>
                `<li style="margin-bottom:8px">☐ ${item}</li>`
            )
            .join("")}
        </ul>
      </body>
    </html>
  `;

  const blob = new Blob([html], {
    type: "application/msword",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = `shopping-list-${createdAt.slice(0, 10)}.doc`;
  link.click();

  URL.revokeObjectURL(url);

  return createdAt;
}
