import { NextResponse } from "next/server";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

type ExportItem =
  | string
  | {
      name: string;
      quantity?: number;
    };

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items: ExportItem[] = body.items ?? [];

    if (!items.length) {
      return NextResponse.json(
        { error: "No items provided" },
        { status: 400 }
      );
    }

    const formattedDate = new Intl.DateTimeFormat("he-IL", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              bidirectional: true,
              children: [
                new TextRun({
                  text: "🛒 רשימת קניות",
                  bold: true,
                  size: 36,
                }),
              ],
            }),
            new Paragraph({
              bidirectional: true,
              spacing: {
                after: 300,
              },
              children: [
                new TextRun({
                  text: `נוצר בתאריך: ${formattedDate}`,
                  italics: true,
                  size: 22,
                }),
              ],
            }),
            ...items.map((item) => {
              const name = typeof item === "string" ? item : item.name;
              const quantity =
                typeof item === "string" ? 1 : Number(item.quantity || 1);

              const quantitySuffix = quantity > 1 ? ` ×${quantity}` : "";

              return new Paragraph({
                bidirectional: true,
                spacing: {
                  after: 180,
                },
                children: [
                  new TextRun({
                    text: `☐ ${name}${quantitySuffix}`,
                    size: 26,
                  }),
                ],
              });
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="shopping-list.docx"',
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Failed to generate document",
      },
      {
        status: 500,
      }
    );
  }
}